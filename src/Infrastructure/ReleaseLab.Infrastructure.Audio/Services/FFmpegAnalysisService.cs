using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ReleaseLab.Application.Interfaces;

namespace ReleaseLab.Infrastructure.Audio.Services;

public class FFmpegAnalysisService : IAudioAnalysisService
{
    private readonly string _ffprobePath;
    private readonly string _ffmpegPath;
    private readonly ILogger<FFmpegAnalysisService> _logger;

    public FFmpegAnalysisService(IConfiguration config, ILogger<FFmpegAnalysisService> logger)
    {
        _ffmpegPath = config["FFmpeg:Path"] ?? "ffmpeg";
        // ffprobe is typically next to ffmpeg
        var ffmpegDir = Path.GetDirectoryName(_ffmpegPath);
        _ffprobePath = !string.IsNullOrEmpty(ffmpegDir)
            ? Path.Combine(ffmpegDir, "ffprobe")
            : "ffprobe";
        _logger = logger;
    }

    public async Task<AudioAnalysisResult> AnalyzeAsync(string filePath, CancellationToken ct = default)
    {
        // 1. Get basic info via ffprobe
        var probeJson = await RunProcessAsync(_ffprobePath,
            $"-v quiet -print_format json -show_format -show_streams \"{filePath}\"", ct);

        double duration = 0;
        int sampleRate = 44100;
        int channels = 2;
        string codec = "unknown";

        try
        {
            using var doc = JsonDocument.Parse(probeJson);
            var root = doc.RootElement;

            if (root.TryGetProperty("format", out var fmt))
            {
                if (fmt.TryGetProperty("duration", out var dur))
                    double.TryParse(dur.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out duration);
            }

            if (root.TryGetProperty("streams", out var streams))
            {
                foreach (var stream in streams.EnumerateArray())
                {
                    if (stream.TryGetProperty("codec_type", out var ct2) && ct2.GetString() == "audio")
                    {
                        if (stream.TryGetProperty("sample_rate", out var sr))
                            int.TryParse(sr.GetString(), out sampleRate);
                        if (stream.TryGetProperty("channels", out var ch))
                            channels = ch.GetInt32();
                        if (stream.TryGetProperty("codec_name", out var cn))
                            codec = cn.GetString() ?? "unknown";
                        break;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse ffprobe output");
        }

        // 2. Get loudness via ffmpeg loudnorm analysis
        double peakDb = 0;
        double loudnessLufs = -14;

        try
        {
            var loudnessOutput = await RunProcessAsync(_ffmpegPath,
                $"-i \"{filePath}\" -af loudnorm=print_format=json -f null -", ct, readStderr: true);

            var jsonMatch = Regex.Match(loudnessOutput, @"\{[^}]+""input_i""[^}]+\}", RegexOptions.Singleline);
            if (jsonMatch.Success)
            {
                using var ldoc = JsonDocument.Parse(jsonMatch.Value);
                var lr = ldoc.RootElement;
                if (lr.TryGetProperty("input_i", out var ii))
                    double.TryParse(ii.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out loudnessLufs);
                if (lr.TryGetProperty("input_tp", out var tp))
                    double.TryParse(tp.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out peakDb);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get loudness data");
        }

        // 3. Generate waveform data (~200 samples)
        var waveform = await GenerateWaveformAsync(filePath, duration, ct);

        return new AudioAnalysisResult(duration, sampleRate, channels, codec, peakDb, loudnessLufs, waveform);
    }

    private async Task<float[]> GenerateWaveformAsync(string filePath, double duration, CancellationToken ct)
    {
        const int sampleCount = 200;
        var waveform = new float[sampleCount];

        try
        {
            // Use astats filter to get RMS levels for each segment
            var segmentDuration = duration / sampleCount;
            if (segmentDuration < 0.01) segmentDuration = 0.01;

            var output = await RunProcessAsync(_ffmpegPath,
                $"-i \"{filePath}\" -af \"asetnsamples=n={Math.Max(1, (int)(44100 * segmentDuration))},astats=metadata=1:reset=1\" " +
                $"-f null -", ct, readStderr: true);

            // Parse RMS levels from astats output
            var rmsValues = new List<float>();
            foreach (Match m in Regex.Matches(output, @"RMS level dB: (-?\d+\.?\d*)"))
            {
                if (double.TryParse(m.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var rms))
                {
                    // Convert dB to linear 0-1 scale
                    var linear = Math.Pow(10, rms / 20.0);
                    rmsValues.Add((float)Math.Min(1.0, linear * 3)); // scale up for visibility
                }
            }

            if (rmsValues.Count > 0)
            {
                // Resample to target count
                for (int i = 0; i < sampleCount; i++)
                {
                    var srcIndex = (int)((double)i / sampleCount * rmsValues.Count);
                    srcIndex = Math.Clamp(srcIndex, 0, rmsValues.Count - 1);
                    waveform[i] = rmsValues[srcIndex];
                }
            }
            else
            {
                // Fallback: generate from peak levels
                await GenerateSimpleWaveform(filePath, waveform, ct);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to generate waveform, using fallback");
            await GenerateSimpleWaveform(filePath, waveform, ct);
        }

        return waveform;
    }

    private async Task GenerateSimpleWaveform(string filePath, float[] waveform, CancellationToken ct)
    {
        // Simple approach: use volumedetect for overall level + random-ish distribution
        try
        {
            var output = await RunProcessAsync(_ffmpegPath,
                $"-i \"{filePath}\" -af volumedetect -f null -", ct, readStderr: true);

            float meanVolume = 0.5f;
            var meanMatch = Regex.Match(output, @"mean_volume: (-?\d+\.?\d*) dB");
            if (meanMatch.Success && double.TryParse(meanMatch.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var mv))
            {
                meanVolume = (float)Math.Min(1.0, Math.Pow(10, mv / 20.0) * 3);
            }

            var rng = new Random(42); // deterministic
            for (int i = 0; i < waveform.Length; i++)
                waveform[i] = Math.Clamp(meanVolume + (float)(rng.NextDouble() - 0.5) * 0.3f, 0.05f, 1f);
        }
        catch
        {
            // Ultimate fallback
            for (int i = 0; i < waveform.Length; i++)
                waveform[i] = 0.5f;
        }
    }

    private static async Task<string> RunProcessAsync(string fileName, string args, CancellationToken ct, bool readStderr = false)
    {
        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = args,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };

        process.Start();
        var stdout = await process.StandardOutput.ReadToEndAsync(ct);
        var stderr = await process.StandardError.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);

        return readStderr ? stderr : stdout;
    }
}
