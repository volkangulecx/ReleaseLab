using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Infrastructure.Data;

namespace ReleaseLab.Api.Services;

public class MixdownService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MixdownService> _logger;
    private readonly IConfiguration _config;

    public MixdownService(IServiceScopeFactory scopeFactory, ILogger<MixdownService> logger, IConfiguration config)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _config = config;
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

        // Check solo — if any track is solo'd, only include solo'd tracks
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

            // Download all tracks
            var trackPaths = new List<(string path, double volume, double pan)>();
            for (int i = 0; i < activeTracks.Count; i++)
            {
                var track = activeTracks[i];
                var localPath = Path.Combine(tempDir, $"track_{i}.wav");

                await minio.GetObjectAsync(new Minio.DataModel.Args.GetObjectArgs()
                    .WithBucket("releaselab-raw")
                    .WithObject(track.File.S3Key)
                    .WithFile(localPath), ct);

                trackPaths.Add((localPath, track.Volume, track.Pan));
            }

            project.Progress = 40;
            await db.SaveChangesAsync(ct);

            // Build FFmpeg complex filter for mixing
            var ffmpegArgs = BuildMixdownArgs(trackPaths, outputPath);
            var ffmpegPath = _config["FFmpeg:Path"] ?? "ffmpeg";

            _logger.LogInformation("Mixdown: {TrackCount} tracks for project {ProjectId}", activeTracks.Count, projectId);

            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = ffmpegPath,
                    Arguments = ffmpegArgs,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                }
            };

            process.Start();
            var stderrTask = process.StandardError.ReadToEndAsync(ct);
            await process.WaitForExitAsync(ct);
            var stderr = await stderrTask;

            if (process.ExitCode != 0)
                throw new InvalidOperationException($"FFmpeg mixdown failed: {stderr[..Math.Min(500, stderr.Length)]}");

            project.Progress = 80;
            await db.SaveChangesAsync(ct);

            // Upload result
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
            project.Status = "failed";
            project.ErrorMessage = ex.Message;
            project.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);
            throw;
        }
        finally
        {
            try { Directory.Delete(tempDir, true); } catch { }
        }
    }

    private static string BuildMixdownArgs(List<(string path, double volume, double pan)> tracks, string output)
    {
        // Build FFmpeg command for multi-track mixing
        // Each track: adjust volume → adjust pan → feed to amix
        var inputs = string.Join(" ", tracks.Select((t, i) => $"-i \"{t.path}\""));
        var filters = new List<string>();

        for (int i = 0; i < tracks.Count; i++)
        {
            var (_, volume, pan) = tracks[i];
            // Volume: 0-2 range → FFmpeg volume filter
            // Pan: -1 to 1 → stereopan (left/right balance)
            var panL = Math.Clamp(1.0 - pan, 0, 2) / 2;
            var panR = Math.Clamp(1.0 + pan, 0, 2) / 2;
            filters.Add($"[{i}:a]volume={volume:F2},pan=stereo|c0={panL:F2}*c0+{panL:F2}*c1|c1={panR:F2}*c0+{panR:F2}*c1[t{i}]");
        }

        var mixInputs = string.Join("", tracks.Select((_, i) => $"[t{i}]"));
        filters.Add($"{mixInputs}amix=inputs={tracks.Count}:duration=longest:normalize=0[out]");

        var filterComplex = string.Join(";", filters);
        return $"-y {inputs} -filter_complex \"{filterComplex}\" -map \"[out]\" -ar 44100 \"{output}\"";
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

        // Analyze each track's RMS loudness and auto-balance
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

            // Target: -18 dBFS average
            const double targetRms = -18.0;
            foreach (var (track, rmsDb) in trackLoudness)
            {
                var diff = targetRms - rmsDb;
                var newVolume = Math.Pow(10, diff / 20.0);
                track.Volume = Math.Clamp(newVolume, 0.1, 2.0);
            }

            // Auto-pan: spread tracks evenly across stereo field
            var count = project.Tracks.Count;
            var orderedTracks = project.Tracks.OrderBy(t => t.OrderIndex).ToList();
            for (int i = 0; i < count; i++)
            {
                orderedTracks[i].Pan = count == 1 ? 0.0 : -0.6 + (1.2 * i / (count - 1));
            }

            project.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            _logger.LogInformation("Auto-mix applied to project {ProjectId}: {TrackCount} tracks balanced", projectId, count);
        }
        finally
        {
            try { Directory.Delete(tempDir, true); } catch { }
        }
    }

    private async Task<double> GetRmsLoudness(string filePath, CancellationToken ct)
    {
        var ffmpegPath = _config["FFmpeg:Path"] ?? "ffmpeg";
        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = ffmpegPath,
                Arguments = $"-i \"{filePath}\" -af volumedetect -f null -",
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            }
        };

        process.Start();
        var stderr = await process.StandardError.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);

        var match = System.Text.RegularExpressions.Regex.Match(stderr, @"mean_volume:\s*(-?\d+\.?\d*)\s*dB");
        return match.Success ? double.Parse(match.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture) : -18.0;
    }
}
