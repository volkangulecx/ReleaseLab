using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Contracts.Messages;
using ReleaseLab.Domain.Enums;
using ReleaseLab.Infrastructure.Data;
using StackExchange.Redis;

namespace ReleaseLab.Worker.Mastering;

public class MasteringWorker : BackgroundService
{
    private readonly ILogger<MasteringWorker> _logger;
    private readonly IConnectionMultiplexer _redis;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly string _ffmpegPath;

    private static readonly string[] QueueKeys = {
        "queue:mastering:priority-high",
        "queue:mastering:priority-normal",
        "queue:mastering:priority-low"
    };

    public MasteringWorker(
        ILogger<MasteringWorker> logger,
        IConnectionMultiplexer redis,
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration)
    {
        _logger = logger;
        _redis = redis;
        _ffmpegPath = configuration["FFmpeg:Path"] ?? "ffmpeg";
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Mastering worker started");
        var db = _redis.GetDatabase();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // BRPOP with priority: high → normal → low
                var result = await db.ListRightPopLeftPushAsync(
                    QueueKeys[0], "queue:mastering:processing", CommandFlags.None);

                if (result.IsNullOrEmpty)
                    result = await db.ListRightPopLeftPushAsync(
                        QueueKeys[1], "queue:mastering:processing", CommandFlags.None);

                if (result.IsNullOrEmpty)
                    result = await db.ListRightPopLeftPushAsync(
                        QueueKeys[2], "queue:mastering:processing", CommandFlags.None);

                if (result.IsNullOrEmpty)
                {
                    await Task.Delay(1000, stoppingToken);
                    continue;
                }

                var message = JsonSerializer.Deserialize<MasteringJobMessage>(result!);
                if (message is null) continue;

                _logger.LogInformation("Processing job {JobId} with preset {Preset}", message.JobId, message.Preset);

                await ProcessJobAsync(message, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in worker loop");
                await Task.Delay(5000, stoppingToken);
            }
        }
    }

    private async Task ProcessJobAsync(MasteringJobMessage message, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var queueService = scope.ServiceProvider.GetRequiredService<IQueueService>();
        var storage = scope.ServiceProvider.GetRequiredService<IStorageService>();

        var job = await db.Jobs.FindAsync(new object[] { message.JobId }, ct);
        if (job is null || job.Status == JobStatus.Completed || job.Status == JobStatus.Cancelled)
        {
            _logger.LogWarning("Job {JobId} not found or already completed/cancelled, skipping", message.JobId);
            return;
        }

        try
        {
            job.Status = JobStatus.Processing;
            job.StartedAt = DateTime.UtcNow;
            job.AttemptCount++;
            await db.SaveChangesAsync(ct);

            // Report progress: downloading
            await queueService.PublishProgressAsync(new JobProgressMessage
            {
                JobId = job.Id, Progress = 10, Stage = "downloading"
            });

            // Download from S3 to temp
            var tempDir = Path.Combine(Path.GetTempPath(), "releaselab", job.Id.ToString());
            Directory.CreateDirectory(tempDir);
            var inputPath = Path.Combine(tempDir, "input.wav");
            var outputWav = Path.Combine(tempDir, "master.wav");
            var outputMp3 = Path.Combine(tempDir, "preview.mp3");

            // Download file from S3 using MinIO client directly
            var minio = scope.ServiceProvider.GetRequiredService<Minio.IMinioClient>();
            await minio.GetObjectAsync(new Minio.DataModel.Args.GetObjectArgs()
                .WithBucket("releaselab-raw")
                .WithObject(message.InputS3Key)
                .WithCallbackStream(async (stream, ct2) =>
                {
                    using var fs = File.Create(inputPath);
                    await stream.CopyToAsync(fs, ct2);
                }), ct);

            await queueService.PublishProgressAsync(new JobProgressMessage
            {
                JobId = job.Id, Progress = 25, Stage = "processing"
            });

            // Build FFmpeg filter chain based on preset
            var filterChain = BuildFilterChain(message.Preset);

            // Process WAV output
            await RunFFmpegAsync(inputPath, outputWav, filterChain, isWav: true, ct);

            await queueService.PublishProgressAsync(new JobProgressMessage
            {
                JobId = job.Id, Progress = 60, Stage = "encoding"
            });

            // Process MP3 preview
            await RunFFmpegAsync(inputPath, outputMp3, filterChain, isWav: false, ct);

            await queueService.PublishProgressAsync(new JobProgressMessage
            {
                JobId = job.Id, Progress = 80, Stage = "uploading"
            });

            // Upload results to S3
            var userId = message.UserId;
            var outputBucket = message.OutputBucket;

            await UploadFileAsync(minio, outputBucket, $"{userId}/{job.Id}/master.wav", outputWav, ct);
            await UploadFileAsync(minio, outputBucket, $"{userId}/{job.Id}/preview.mp3", outputMp3, ct);

            // Update job status
            job.Status = JobStatus.Completed;
            job.Progress = 100;
            job.FinishedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            await queueService.PublishProgressAsync(new JobProgressMessage
            {
                JobId = job.Id, Progress = 100, Stage = "completed"
            });

            _logger.LogInformation("Job {JobId} completed successfully", job.Id);

            // Cleanup temp files
            try { Directory.Delete(tempDir, true); } catch { }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Job {JobId} failed", job.Id);

            job.Status = message.AttemptCount >= 3 ? JobStatus.Dead : JobStatus.Failed;
            job.ErrorCode = "PROCESSING_ERROR";
            job.ErrorMessage = ex.Message;
            job.FinishedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            if (job.Status == JobStatus.Failed)
            {
                // Re-enqueue for retry
                await queueService.EnqueueMasteringJobAsync(message with
                {
                    AttemptCount = message.AttemptCount + 1,
                    EnqueuedAt = DateTime.UtcNow
                });
            }
        }
    }

    private static string BuildFilterChain(string preset) => preset.ToLowerInvariant() switch
    {
        "warm" => "highpass=f=30," +
                  "equalizer=f=200:width_type=o:width=2:g=1.5," +
                  "equalizer=f=3000:width_type=o:width=2:g=-1," +
                  "acompressor=threshold=-20dB:ratio=2.5:attack=15:release=250," +
                  "loudnorm=I=-14:TP=-1:LRA=11," +
                  "alimiter=limit=0.95",

        "bright" => "highpass=f=30," +
                    "equalizer=f=4000:width_type=o:width=2:g=2," +
                    "equalizer=f=10000:width_type=o:width=2:g=1.5," +
                    "acompressor=threshold=-18dB:ratio=2:attack=10:release=200," +
                    "loudnorm=I=-14:TP=-1:LRA=9," +
                    "alimiter=limit=0.95",

        "loud" => "highpass=f=30," +
                  "equalizer=f=80:width_type=o:width=2:g=2," +
                  "equalizer=f=8000:width_type=o:width=2:g=1.5," +
                  "acompressor=threshold=-18dB:ratio=3:attack=10:release=200," +
                  "loudnorm=I=-9:TP=-1:LRA=7," +
                  "alimiter=limit=0.95",

        _ => "highpass=f=30," + // balanced (default)
             "equalizer=f=200:width_type=o:width=2:g=0.5," +
             "equalizer=f=5000:width_type=o:width=2:g=0.5," +
             "acompressor=threshold=-20dB:ratio=2:attack=12:release=200," +
             "loudnorm=I=-14:TP=-1:LRA=11," +
             "alimiter=limit=0.95"
    };

    private async Task RunFFmpegAsync(string input, string output, string filterChain, bool isWav, CancellationToken ct)
    {
        var args = isWav
            ? $"-i \"{input}\" -af \"{filterChain}\" -ar 44100 \"{output}\""
            : $"-i \"{input}\" -af \"{filterChain}\" -ar 44100 -b:a 320k \"{output}\"";

        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = _ffmpegPath,
                Arguments = $"-y {args}",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };

        process.Start();
        await process.WaitForExitAsync(ct);

        if (process.ExitCode != 0)
        {
            var error = await process.StandardError.ReadToEndAsync(ct);
            throw new InvalidOperationException($"FFmpeg failed (exit {process.ExitCode}): {error}");
        }
    }

    private static async Task UploadFileAsync(Minio.IMinioClient minio, string bucket, string key, string filePath, CancellationToken ct)
    {
        // Ensure bucket exists
        bool found = await minio.BucketExistsAsync(new Minio.DataModel.Args.BucketExistsArgs().WithBucket(bucket), ct);
        if (!found)
            await minio.MakeBucketAsync(new Minio.DataModel.Args.MakeBucketArgs().WithBucket(bucket), ct);

        await minio.PutObjectAsync(new Minio.DataModel.Args.PutObjectArgs()
            .WithBucket(bucket)
            .WithObject(key)
            .WithFileName(filePath), ct);
    }
}
