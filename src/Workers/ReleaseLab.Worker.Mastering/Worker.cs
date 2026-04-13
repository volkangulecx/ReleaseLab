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

            // Download file from S3 using MinIO client
            var minio = scope.ServiceProvider.GetRequiredService<Minio.IMinioClient>();
            _logger.LogInformation("Downloading {S3Key} from S3...", message.InputS3Key);

            using var downloadCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            downloadCts.CancelAfter(TimeSpan.FromMinutes(5)); // 5 min timeout for download

            try
            {
                await minio.GetObjectAsync(new Minio.DataModel.Args.GetObjectArgs()
                    .WithBucket("releaselab-raw")
                    .WithObject(message.InputS3Key)
                    .WithFile(inputPath), downloadCts.Token);
            }
            catch (Exception dlEx)
            {
                _logger.LogError(dlEx, "Failed to download {S3Key} from S3", message.InputS3Key);
                throw new InvalidOperationException($"S3 download failed: {dlEx.Message}", dlEx);
            }

            var fileSize = new FileInfo(inputPath).Length;
            _logger.LogInformation("Downloaded {S3Key}: {Size} bytes", message.InputS3Key, fileSize);

            if (fileSize == 0)
                throw new InvalidOperationException("Downloaded file is empty — upload may have failed");

            await queueService.PublishProgressAsync(new JobProgressMessage
            {
                JobId = job.Id, Progress = 25, Stage = "processing"
            });

            // Build professional mastering chain
            var filterChain = ProMasteringChain.Build(message);
            _logger.LogInformation("Filter chain ({Length} chars): {Chain}", filterChain.Length, filterChain[..Math.Min(200, filterChain.Length)]);
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

    private static string BuildFilterChain(MasteringJobMessage msg)
    {
        var preset = msg.Preset.ToLowerInvariant();

        // Get base preset parameters
        var (eq, comp, stereo, lufs, lra) = preset switch
        {
            // Standard presets
            "warm"     => ("equalizer=f=200:width_type=o:width=2:g=1.5,equalizer=f=3000:width_type=o:width=2:g=-1", "acompressor=threshold=-20dB:ratio=2.5:attack=15:release=250", 1.4, -14, 11),
            "bright"   => ("equalizer=f=4000:width_type=o:width=2:g=2,equalizer=f=10000:width_type=o:width=2:g=1.5", "acompressor=threshold=-18dB:ratio=2:attack=10:release=200", 1.6, -14, 9),
            "loud"     => ("equalizer=f=80:width_type=o:width=2:g=2,equalizer=f=8000:width_type=o:width=2:g=1.5", "acompressor=threshold=-18dB:ratio=3:attack=10:release=200", 1.3, -9, 7),

            // Genre presets
            "hiphop"   => ("equalizer=f=60:width_type=o:width=1.5:g=3,equalizer=f=100:width_type=o:width=2:g=2,equalizer=f=3000:width_type=o:width=2:g=1.5,equalizer=f=8000:width_type=o:width=2:g=1", "acompressor=threshold=-15dB:ratio=4:attack=5:release=150", 1.2, -9, 7),
            "edm"      => ("equalizer=f=50:width_type=o:width=1:g=3,equalizer=f=200:width_type=o:width=2:g=-1,equalizer=f=5000:width_type=o:width=2:g=2,equalizer=f=12000:width_type=o:width=2:g=1.5", "acompressor=threshold=-12dB:ratio=3.5:attack=3:release=100", 1.8, -8, 6),
            "jazz"     => ("equalizer=f=200:width_type=o:width=2:g=1,equalizer=f=800:width_type=o:width=2:g=0.5,equalizer=f=3000:width_type=o:width=2:g=-0.5", "acompressor=threshold=-24dB:ratio=1.5:attack=30:release=400", 1.3, -16, 14),
            "classical"=> ("equalizer=f=250:width_type=o:width=2:g=0.3,equalizer=f=4000:width_type=o:width=2:g=0.5", "acompressor=threshold=-28dB:ratio=1.2:attack=50:release=500", 1.1, -18, 16),
            "pop"      => ("equalizer=f=150:width_type=o:width=2:g=1,equalizer=f=2500:width_type=o:width=2:g=2,equalizer=f=6000:width_type=o:width=2:g=1.5,equalizer=f=10000:width_type=o:width=2:g=1", "acompressor=threshold=-16dB:ratio=3:attack=8:release=180", 1.4, -11, 8),
            "rock"     => ("equalizer=f=80:width_type=o:width=2:g=2,equalizer=f=500:width_type=o:width=2:g=1,equalizer=f=2000:width_type=o:width=2:g=1.5,equalizer=f=8000:width_type=o:width=2:g=1", "acompressor=threshold=-14dB:ratio=3.5:attack=5:release=150", 1.3, -10, 7),

            // Default: balanced
            _ => ("equalizer=f=200:width_type=o:width=2:g=0.5,equalizer=f=5000:width_type=o:width=2:g=0.5", "acompressor=threshold=-20dB:ratio=2:attack=12:release=200", 1.2, -14, 11),
        };

        // Override LUFS target based on platform
        var targetLufs = msg.LoudnessTarget?.ToLowerInvariant() switch
        {
            "spotify" => -14,
            "apple" => -16,
            "youtube" => -13,
            "club" => -8,
            "custom" => (int)(msg.CustomLufs ?? -14),
            _ => lufs
        };

        // Apply custom EQ overrides if provided (use InvariantCulture to avoid Turkish comma)
        var ic = System.Globalization.CultureInfo.InvariantCulture;
        var customEq = "";
        if (msg.LowEq.HasValue && Math.Abs(msg.LowEq.Value) > 0.1)
            customEq += $",equalizer=f=200:width_type=o:width=2:g={msg.LowEq.Value.ToString("F1", ic)}";
        if (msg.MidEq.HasValue && Math.Abs(msg.MidEq.Value) > 0.1)
            customEq += $",equalizer=f=2000:width_type=o:width=2:g={msg.MidEq.Value.ToString("F1", ic)}";
        if (msg.HighEq.HasValue && Math.Abs(msg.HighEq.Value) > 0.1)
            customEq += $",equalizer=f=10000:width_type=o:width=2:g={msg.HighEq.Value.ToString("F1", ic)}";

        // Vocal processing filters
        var vocalProcessing = "";

        // De-breath: gate that closes on quiet passages (breaths are typically -40dB to -25dB)
        if (msg.DeBreath)
            vocalProcessing += ",agate=threshold=0.02:ratio=8:attack=1:release=50:range=0.05";

        // De-noise: high-pass at 80Hz + gentle noise gate
        if (msg.DeNoise)
            vocalProcessing += ",highpass=f=80,afftdn=nf=-25";

        // De-ess: reduce sibilance in 4-10kHz range
        if (msg.DeEss)
            vocalProcessing += ",firequalizer=gain_entry='entry(0,0);entry(4000,0);entry(6000,-4);entry(8000,-6);entry(10000,-3);entry(12000,0)'";

        return $"highpass=f=30,{eq}{customEq},{comp}{vocalProcessing},extrastereo=m={stereo.ToString("F1", ic)},loudnorm=I={targetLufs}:TP=-1:LRA={lra},alimiter=limit=0.95";
    }

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

        // Read stderr asynchronously to prevent deadlock (FFmpeg writes a lot to stderr)
        var stderrTask = process.StandardError.ReadToEndAsync(ct);
        var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);

        // Timeout: 10 minutes max per FFmpeg call
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(TimeSpan.FromMinutes(10));

        try
        {
            await process.WaitForExitAsync(timeoutCts.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            // Timeout — kill FFmpeg
            try { process.Kill(true); } catch { }
            throw new TimeoutException($"FFmpeg timed out after 10 minutes for {output}");
        }

        var error = await stderrTask;

        if (process.ExitCode != 0)
        {
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
