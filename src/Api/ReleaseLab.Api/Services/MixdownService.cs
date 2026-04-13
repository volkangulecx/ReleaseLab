using System.Diagnostics;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Infrastructure.Data;

namespace ReleaseLab.Api.Services;

public class MixdownService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MixdownService> _logger;
    private readonly string _ffmpegPath;

    public MixdownService(IServiceScopeFactory scopeFactory, ILogger<MixdownService> logger, IConfiguration config)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _ffmpegPath = config["FFmpeg:Path"] ?? "ffmpeg";
    }

    public async Task<string> ExportMixdownAsync(Guid projectId, Guid userId, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var minio = scope.ServiceProvider.GetRequiredService<Minio.IMinioClient>();

        var project = await db.MixProjects
            .Include(p => p.Tracks).ThenInclude(t => t.File)
            .FirstOrDefaultAsync(p => p.Id == projectId && p.UserId == userId, ct);

        if (project is null) throw new KeyNotFoundException("Project not found");

        var activeTracks = project.Tracks
            .Where(t => !t.Muted)
            .OrderBy(t => t.OrderIndex)
            .ToList();

        if (activeTracks.Count == 0) throw new InvalidOperationException("No active tracks to mix");

        var soloTracks = activeTracks.Where(t => t.Solo).ToList();
        if (soloTracks.Count > 0) activeTracks = soloTracks;

        var tempDir = Path.Combine(Path.GetTempPath(), "releaselab-mix", projectId.ToString());
        Directory.CreateDirectory(tempDir);
        var outputPath = Path.Combine(tempDir, "mixdown.wav");

        try
        {
            project.Status = "mixing";
            project.Progress = 10;
            await db.SaveChangesAsync(ct);

            // Download all tracks using WithFile (not WithCallbackStream — that hangs)
            // Download and prepare track info
            var trackInfos = new List<TrackMixInfo>();
            for (int i = 0; i < activeTracks.Count; i++)
            {
                var track = activeTracks[i];
                var localPath = Path.Combine(tempDir, $"track_{i}.wav");

                await minio.GetObjectAsync(new Minio.DataModel.Args.GetObjectArgs()
                    .WithBucket("releaselab-raw")
                    .WithObject(track.File.S3Key)
                    .WithFile(localPath), ct);

                trackInfos.Add(new TrackMixInfo(localPath, track.Volume, track.Pan,
                    track.LowGain, track.MidGain, track.HighGain,
                    track.CompressorThreshold));
            }

            project.Progress = 40;
            await db.SaveChangesAsync(ct);

            _logger.LogInformation("Mixdown: {TrackCount} tracks for project {ProjectId}", activeTracks.Count, projectId);

            // Build per-track filter chains with EQ + compressor
            var inputs = string.Join(" ", trackInfos.Select((t, i) => $"-i \"{t.Path}\""));
            var filters = new List<string>();

            for (int i = 0; i < trackInfos.Count; i++)
            {
                var t = trackInfos[i];
                var chain = BuildTrackFilterChain(t, i);
                filters.Add(chain);
            }

            if (trackInfos.Count == 1)
            {
                filters.Add("[t0]acopy[out]");
            }
            else
            {
                var mixInputs = string.Join("", Enumerable.Range(0, trackInfos.Count).Select(i => $"[t{i}]"));
                filters.Add($"{mixInputs}amix=inputs={trackInfos.Count}:duration=longest[out]");
            }

            var filterComplex = string.Join(";", filters);
            await RunFFmpeg($"-y {inputs} -filter_complex \"{filterComplex}\" -map \"[out]\" -ar 44100 \"{outputPath}\"", ct);

            project.Progress = 80;
            await db.SaveChangesAsync(ct);

            // Upload
            var outputBucket = "releaselab-processed";
            var outputKey = $"{userId}/{projectId}/mixdown.wav";

            bool found = await minio.BucketExistsAsync(new Minio.DataModel.Args.BucketExistsArgs().WithBucket(outputBucket), ct);
            if (!found) await minio.MakeBucketAsync(new Minio.DataModel.Args.MakeBucketArgs().WithBucket(outputBucket), ct);

            await minio.PutObjectAsync(new Minio.DataModel.Args.PutObjectArgs()
                .WithBucket(outputBucket)
                .WithObject(outputKey)
                .WithFileName(outputPath), ct);

            project.Status = "completed";
            project.Progress = 100;
            project.OutputS3Key = outputKey;
            project.CompletedAt = DateTime.UtcNow;
            project.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            _logger.LogInformation("Mixdown completed: {ProjectId}", projectId);
            return outputKey;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Mixdown failed: {ProjectId}", projectId);
            project.Status = "failed";
            project.ErrorMessage = ex.Message[..Math.Min(500, ex.Message.Length)];
            project.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);
            throw;
        }
        finally
        {
            try { Directory.Delete(tempDir, true); } catch { }
        }
    }

    public async Task AutoMixAsync(Guid projectId, Guid userId, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var minio = scope.ServiceProvider.GetRequiredService<Minio.IMinioClient>();

        var project = await db.MixProjects
            .Include(p => p.Tracks).ThenInclude(t => t.File)
            .FirstOrDefaultAsync(p => p.Id == projectId && p.UserId == userId, ct);

        if (project is null) throw new KeyNotFoundException("Project not found");
        if (project.Tracks.Count == 0) throw new InvalidOperationException("No tracks to auto-mix");

        var tempDir = Path.Combine(Path.GetTempPath(), "releaselab-automix", projectId.ToString());
        Directory.CreateDirectory(tempDir);

        try
        {
            var trackLoudness = new List<(Domain.Entities.MixTrack track, double rmsDb)>();

            foreach (var track in project.Tracks)
            {
                var localPath = Path.Combine(tempDir, $"{track.Id}.wav");
                await minio.GetObjectAsync(new Minio.DataModel.Args.GetObjectArgs()
                    .WithBucket("releaselab-raw")
                    .WithObject(track.File.S3Key)
                    .WithFile(localPath), ct);

                var rmsDb = await GetRmsLoudness(localPath, ct);
                trackLoudness.Add((track, rmsDb));
            }

            const double targetRms = -18.0;
            foreach (var (track, rmsDb) in trackLoudness)
            {
                var diff = targetRms - rmsDb;
                var newVolume = Math.Pow(10, diff / 20.0);
                track.Volume = Math.Clamp(newVolume, 0.1, 2.0);
            }

            var count = project.Tracks.Count;
            var orderedTracks = project.Tracks.OrderBy(t => t.OrderIndex).ToList();
            for (int i = 0; i < count; i++)
            {
                orderedTracks[i].Pan = count == 1 ? 0.0 : -0.6 + (1.2 * i / (count - 1));
            }

            project.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        finally
        {
            try { Directory.Delete(tempDir, true); } catch { }
        }
    }

    private async Task RunFFmpeg(string args, CancellationToken ct)
    {
        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = _ffmpegPath,
                Arguments = args,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            }
        };

        process.Start();
        var stderrTask = process.StandardError.ReadToEndAsync(ct);
        await process.StandardOutput.ReadToEndAsync(ct);

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(TimeSpan.FromMinutes(10));

        await process.WaitForExitAsync(timeoutCts.Token);
        var stderr = await stderrTask;

        if (process.ExitCode != 0)
        {
            // Get last 500 chars of stderr (actual error is at the end, not version info at start)
            var errorPart = stderr.Length > 500 ? stderr[^500..] : stderr;
            throw new InvalidOperationException($"FFmpeg exit {process.ExitCode}: {errorPart}");
        }
    }

    private async Task<double> GetRmsLoudness(string filePath, CancellationToken ct)
    {
        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = _ffmpegPath,
                Arguments = $"-i \"{filePath}\" -af volumedetect -f null -",
                RedirectStandardError = true,
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            }
        };

        process.Start();
        var stderr = await process.StandardError.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);

        var match = System.Text.RegularExpressions.Regex.Match(stderr, @"mean_volume:\s*(-?\d+\.?\d*)\s*dB");
        return match.Success ? double.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture) : -18.0;
    }

    private static string BuildTrackFilterChain(TrackMixInfo t, int index)
    {
        var parts = new List<string>();
        var ic = CultureInfo.InvariantCulture;

        // Volume
        parts.Add($"volume={t.Volume.ToString("F2", ic)}");

        // 3-band EQ (only if non-zero)
        if (Math.Abs(t.LowGain) > 0.1)
            parts.Add($"equalizer=f=200:width_type=o:width=2:g={t.LowGain.ToString("F1", ic)}");
        if (Math.Abs(t.MidGain) > 0.1)
            parts.Add($"equalizer=f=1000:width_type=o:width=2:g={t.MidGain.ToString("F1", ic)}");
        if (Math.Abs(t.HighGain) > 0.1)
            parts.Add($"equalizer=f=8000:width_type=o:width=2:g={t.HighGain.ToString("F1", ic)}");

        // Compressor (only if threshold < 0)
        if (t.CompressorThreshold < -1)
            parts.Add($"acompressor=threshold={t.CompressorThreshold.ToString("F0", ic)}dB:ratio=3:attack=10:release=200");

        return $"[{index}:a]{string.Join(",", parts)}[t{index}]";
    }

    private record TrackMixInfo(
        string Path, double Volume, double Pan,
        double LowGain, double MidGain, double HighGain,
        double CompressorThreshold);
}
