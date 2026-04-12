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

        var sw = System.Diagnostics.Stopwatch.StartNew();
        WorkerMetrics.ActiveJobs.Add(1);

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
            var outputMasterMp3 = Path.Combine(tempDir, "master.mp3");
            var outputPreviewMp3 = Path.Combine(tempDir, "preview.mp3");

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
            var isHiRes = string.Equals(message.Quality, "HiRes", StringComparison.OrdinalIgnoreCase);

            // Process master WAV (44100Hz, full quality)
            await RunFFmpegAsync(inputPath, outputWav, filterChain, OutputFormat.MasterWav, ct);

            await queueService.PublishProgressAsync(new JobProgressMessage
            {
                JobId = job.Id, Progress = 45, Stage = "encoding-master-mp3"
            });

            // Process master MP3 (320kbps, full quality)
            await RunFFmpegAsync(inputPath, outputMasterMp3, filterChain, OutputFormat.MasterMp3, ct);

            await queueService.PublishProgressAsync(new JobProgressMessage
            {
                JobId = job.Id, Progress = 60, Stage = "encoding-preview"
            });

            // Process preview MP3 — watermark only for Free plan (Sec 15.1: Pro/Studio get clean preview)
            var isFree = string.Equals(message.UserPlan, "Free", StringComparison.OrdinalIgnoreCase);
            var previewFormat = isFree ? OutputFormat.PreviewMp3 : OutputFormat.PreviewMp3Clean;
            await RunFFmpegAsync(inputPath, outputPreviewMp3, filterChain, previewFormat, ct);

            await queueService.PublishProgressAsync(new JobProgressMessage
            {
                JobId = job.Id, Progress = 80, Stage = "uploading"
            });

            // Upload results to S3
            var userId = message.UserId;
            var outputBucket = message.OutputBucket;

            // Always upload preview MP3
            await UploadFileAsync(minio, outputBucket, $"{userId}/{job.Id}/preview.mp3", outputPreviewMp3, ct);

            // Only upload master files (WAV + 320kbps MP3) if quality is HiRes
            if (isHiRes)
            {
                await UploadFileAsync(minio, outputBucket, $"{userId}/{job.Id}/master.wav", outputWav, ct);
                await UploadFileAsync(minio, outputBucket, $"{userId}/{job.Id}/master.mp3", outputMasterMp3, ct);
            }

            // Update job status
            job.Status = JobStatus.Completed;
            job.Progress = 100;
            job.FinishedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            await queueService.PublishProgressAsync(new JobProgressMessage
            {
                JobId = job.Id, Progress = 100, Stage = "completed"
            });

            sw.Stop();
            WorkerMetrics.JobsProcessed.Add(1, new KeyValuePair<string, object?>("preset", message.Preset));
            WorkerMetrics.ProcessingDuration.Record(sw.Elapsed.TotalSeconds, new KeyValuePair<string, object?>("preset", message.Preset));
            _logger.LogInformation("Job {JobId} completed successfully (HiRes={IsHiRes}) in {Duration}s", job.Id, isHiRes, sw.Elapsed.TotalSeconds);

            // Cleanup temp files
            try { Directory.Delete(tempDir, true); } catch { }
        }
        catch (Exception ex)
        {
            sw.Stop();
            WorkerMetrics.JobsFailed.Add(1);
            _logger.LogError(ex, "Job {JobId} failed after {Duration}s", job.Id, sw.Elapsed.TotalSeconds);

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
        finally
        {
            WorkerMetrics.ActiveJobs.Add(-1);
        }
    }

    private static string BuildFilterChain(string preset) => preset.ToLowerInvariant() switch
    {
        "warm" => "highpass=f=30," +
                  "equalizer=f=200:width_type=o:width=2:g=1.5," +
                  "equalizer=f=3000:width_type=o:width=2:g=-1," +
                  "acompressor=threshold=-20dB:ratio=2.5:attack=15:release=250," +
                  "stereotools=widening=0.2," +
                  "loudnorm=I=-14:TP=-1:LRA=11," +
                  "alimiter=limit=0.95",

        "bright" => "highpass=f=30," +
                    "equalizer=f=4000:width_type=o:width=2:g=2," +
                    "equalizer=f=10000:width_type=o:width=2:g=1.5," +
                    "acompressor=threshold=-18dB:ratio=2:attack=10:release=200," +
                    "stereotools=widening=0.3," +
                    "loudnorm=I=-14:TP=-1:LRA=9," +
                    "alimiter=limit=0.95",

        "loud" => "highpass=f=30," +
                  "equalizer=f=80:width_type=o:width=2:g=2," +
                  "equalizer=f=8000:width_type=o:width=2:g=1.5," +
                  "acompressor=threshold=-18dB:ratio=3:attack=10:release=200," +
                  "stereotools=widening=0.15," +
                  "loudnorm=I=-9:TP=-1:LRA=7," +
                  "alimiter=limit=0.95",

        _ => "highpass=f=30," + // balanced (default)
             "equalizer=f=200:width_type=o:width=2:g=0.5," +
             "equalizer=f=5000:width_type=o:width=2:g=0.5," +
             "acompressor=threshold=-20dB:ratio=2:attack=12:release=200," +
             "stereotools=widening=0.1," +
             "loudnorm=I=-14:TP=-1:LRA=11," +
             "alimiter=limit=0.95"
    };

    private enum OutputFormat
    {
        MasterWav,
        MasterMp3,
        PreviewMp3,
        PreviewMp3Clean  // No watermark — for Pro/Studio plans
    }

    private async Task RunFFmpegAsync(string input, string output, string filterChain, OutputFormat format, CancellationToken ct)
    {
        string args;

        switch (format)
        {
            case OutputFormat.MasterWav:
                // Full quality WAV at 44100Hz
                args = $"-i \"{input}\" -af \"{filterChain}\" -ar 44100 \"{output}\"";
                break;

            case OutputFormat.MasterMp3:
                // Full quality MP3 at 320kbps
                args = $"-i \"{input}\" -af \"{filterChain}\" -ar 44100 -b:a 320k \"{output}\"";
                break;

            case OutputFormat.PreviewMp3:
                // Preview MP3: 128kbps with a subtle 15kHz watermark tone mixed in every 30 seconds.
                // Uses a complex filter graph:
                //   [0:a] applies the mastering filter chain to the input audio
                //   sine generates a quiet 15kHz beep (1 second on, 29 seconds off, repeating)
                //   amix combines the two streams, keeping the duration of the first (the music)
                var watermarkFilter =
                    $"[0:a]{filterChain}[master];" +
                    $"sine=frequency=15000:sample_rate=44100:duration=1,volume=0.03," +
                    $"aloop=loop=-1:size=44100*30[beep];" +
                    $"[master][beep]amix=inputs=2:duration=first:dropout_transition=0";
                args = $"-i \"{input}\" -filter_complex \"{watermarkFilter}\" -ar 44100 -b:a 128k \"{output}\"";
                break;

            case OutputFormat.PreviewMp3Clean:
                // Clean preview for Pro/Studio plans — 128kbps, no watermark
                args = $"-i \"{input}\" -af \"{filterChain}\" -ar 44100 -b:a 128k \"{output}\"";
                break;

            default:
                throw new ArgumentOutOfRangeException(nameof(format));
        }

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
