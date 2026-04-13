using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ReleaseLab.Api.Services;

/// <summary>
/// Analyzes audio and recommends optimal mastering/mixing settings.
/// Uses FFmpeg/FFprobe to detect: genre characteristics, frequency balance,
/// dynamics, loudness, noise floor, sibilance level.
/// </summary>
public class AudioRecommendationService
{
    private readonly string _ffmpegPath;
    private readonly string _ffprobePath;
    private readonly ILogger<AudioRecommendationService> _logger;

    public AudioRecommendationService(IConfiguration config, ILogger<AudioRecommendationService> logger)
    {
        _ffmpegPath = config["FFmpeg:Path"] ?? "ffmpeg";
        var dir = Path.GetDirectoryName(_ffmpegPath);
        _ffprobePath = !string.IsNullOrEmpty(dir) ? Path.Combine(dir, "ffprobe") : "ffprobe";
        _logger = logger;
    }

    public async Task<MasteringRecommendation> AnalyzeAndRecommendAsync(string filePath, CancellationToken ct = default)
    {
        _logger.LogInformation("Analyzing audio for recommendations: {Path}", filePath);

        // Run all analyses in parallel
        var spectrumTask = AnalyzeSpectrum(filePath, ct);
        var dynamicsTask = AnalyzeDynamics(filePath, ct);
        var loudnessTask = AnalyzeLoudness(filePath, ct);
        var infoTask = GetAudioInfo(filePath, ct);

        await Task.WhenAll(spectrumTask, dynamicsTask, loudnessTask, infoTask);

        var spectrum = await spectrumTask;
        var dynamics = await dynamicsTask;
        var loudness = await loudnessTask;
        var info = await infoTask;

        // Analyze characteristics
        var hasBass = spectrum.LowEnergy > 0.3;
        var hasBrightness = spectrum.HighEnergy > 0.25;
        var isVocal = spectrum.MidEnergy > 0.35 && spectrum.HighEnergy > 0.15;
        var isLoud = loudness.MeanRms > -15;
        var isDynamic = dynamics.DynamicRange > 12;
        var hasNoise = dynamics.NoiseFloor > -50;
        var hasSibilance = spectrum.SibilanceEnergy > 0.2;
        var hasBreaths = dynamics.SilenceRatio > 0.05;

        // Determine best preset
        var preset = DeterminePreset(spectrum, dynamics, loudness);

        // Calculate EQ recommendations
        var eqRecommendation = CalculateEqRecommendation(spectrum);

        // Determine loudness target
        var targetLufs = isLoud ? -11 : isDynamic ? -16 : -14;

        // Build recommendation
        var rec = new MasteringRecommendation
        {
            // Audio info
            Duration = info.Duration,
            SampleRate = info.SampleRate,
            Channels = info.Channels,
            Codec = info.Codec,

            // Analysis results
            MeanLoudness = Math.Round(loudness.MeanRms, 1),
            PeakLevel = Math.Round(loudness.Peak, 1),
            DynamicRange = Math.Round(dynamics.DynamicRange, 1),
            NoiseFloor = Math.Round(dynamics.NoiseFloor, 1),
            FrequencyBalance = new FrequencyBalance
            {
                Low = Math.Round(spectrum.LowEnergy * 100, 0),
                Mid = Math.Round(spectrum.MidEnergy * 100, 0),
                High = Math.Round(spectrum.HighEnergy * 100, 0),
            },

            // Detected characteristics
            Characteristics = new List<string>(),

            // Recommendations
            RecommendedPreset = preset,
            RecommendedLufs = targetLufs,
            RecommendedLoudnessTarget = targetLufs <= -16 ? "apple" : targetLufs >= -11 ? "club" : "spotify",
            DeBreath = hasBreaths && isVocal,
            DeNoise = hasNoise,
            DeEss = hasSibilance && isVocal,
            LowEq = eqRecommendation.Low,
            MidEq = eqRecommendation.Mid,
            HighEq = eqRecommendation.High,

            // Confidence
            Confidence = CalculateConfidence(spectrum, dynamics, loudness),
            Summary = "",
        };

        // Build characteristics list
        if (hasBass) rec.Characteristics.Add("Bass-heavy");
        if (hasBrightness) rec.Characteristics.Add("Bright/Airy");
        if (isVocal) rec.Characteristics.Add("Vocal-forward");
        if (isLoud) rec.Characteristics.Add("Already loud");
        if (isDynamic) rec.Characteristics.Add("High dynamic range");
        if (hasNoise) rec.Characteristics.Add("Background noise detected");
        if (hasSibilance) rec.Characteristics.Add("Sibilance present");
        if (hasBreaths) rec.Characteristics.Add("Breath sounds detected");

        // Build summary
        rec.Summary = BuildSummary(rec);

        _logger.LogInformation("Recommendation: preset={Preset}, LUFS={Lufs}, confidence={Confidence}%",
            preset, targetLufs, rec.Confidence);

        return rec;
    }

    public async Task<MixingRecommendation> AnalyzeTracksAndRecommendAsync(
        List<(string path, string name)> tracks, CancellationToken ct = default)
    {
        var trackAnalyses = new List<TrackAnalysis>();

        foreach (var (path, name) in tracks)
        {
            var spectrum = await AnalyzeSpectrum(path, ct);
            var loudness = await AnalyzeLoudness(path, ct);

            var role = DetectTrackRole(spectrum, name);

            trackAnalyses.Add(new TrackAnalysis
            {
                Name = name,
                Role = role,
                MeanLoudness = Math.Round(loudness.MeanRms, 1),
                RecommendedVolume = 1.0,
                RecommendedPan = 0.0,
                RecommendedEqPreset = GetEqPresetForRole(role),
                FrequencyBalance = new FrequencyBalance
                {
                    Low = Math.Round(spectrum.LowEnergy * 100, 0),
                    Mid = Math.Round(spectrum.MidEnergy * 100, 0),
                    High = Math.Round(spectrum.HighEnergy * 100, 0),
                },
            });
        }

        // Balance volumes — target -18 dBFS mean
        var targetRms = -18.0;
        foreach (var t in trackAnalyses)
        {
            var diff = targetRms - t.MeanLoudness;
            t.RecommendedVolume = Math.Round(Math.Clamp(Math.Pow(10, diff / 20.0), 0.1, 2.0), 2);
        }

        // Auto-pan based on roles
        AssignPanPositions(trackAnalyses);

        return new MixingRecommendation
        {
            Tracks = trackAnalyses,
            Summary = $"Analyzed {trackAnalyses.Count} tracks. Volumes balanced to -18 dBFS, panned by instrument role.",
        };
    }

    // ── Analysis helpers ──

    private async Task<SpectrumAnalysis> AnalyzeSpectrum(string path, CancellationToken ct)
    {
        // Use FFmpeg astats to get frequency distribution
        var stderr = await RunFFmpeg($"-i \"{path}\" -af \"asplit=3[low][mid][high];[low]lowpass=f=300,astats=metadata=1:reset=1[lo];[mid]bandpass=f=2000:width_type=h:width=4000,astats=metadata=1:reset=1[mi];[high]highpass=f=6000,astats=metadata=1:reset=1[hi]\" -map \"[lo]\" -map \"[mi]\" -map \"[hi]\" -f null -", ct);

        // Parse RMS levels from different bands
        var rmsValues = Regex.Matches(stderr, @"RMS level dB:\s*(-?\d+\.?\d*)");
        var levels = rmsValues.Select(m => double.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture)).ToList();

        double lowE = 0.33, midE = 0.33, highE = 0.33;
        if (levels.Count >= 3)
        {
            var total = levels.Select(l => Math.Pow(10, l / 20.0)).Sum();
            if (total > 0)
            {
                lowE = Math.Pow(10, levels[0] / 20.0) / total;
                midE = Math.Pow(10, levels[1] / 20.0) / total;
                highE = Math.Pow(10, levels[2] / 20.0) / total;
            }
        }

        // Check sibilance (4-10kHz)
        var sibilanceSterr = await RunFFmpeg($"-i \"{path}\" -af \"bandpass=f=7000:width_type=h:width=6000,astats=metadata=1:reset=1\" -f null -", ct);
        var sibMatch = Regex.Match(sibilanceSterr, @"RMS level dB:\s*(-?\d+\.?\d*)");
        var sibLevel = sibMatch.Success ? double.Parse(sibMatch.Groups[1].Value, CultureInfo.InvariantCulture) : -60;

        return new SpectrumAnalysis
        {
            LowEnergy = lowE,
            MidEnergy = midE,
            HighEnergy = highE,
            SibilanceEnergy = Math.Pow(10, sibLevel / 20.0),
        };
    }

    private async Task<DynamicsAnalysis> AnalyzeDynamics(string path, CancellationToken ct)
    {
        var stderr = await RunFFmpeg($"-i \"{path}\" -af astats=metadata=1 -f null -", ct);

        var peakMatch = Regex.Match(stderr, @"Peak level dB:\s*(-?\d+\.?\d*)");
        var rmsMatch = Regex.Match(stderr, @"RMS level dB:\s*(-?\d+\.?\d*)");
        var noiseMatch = Regex.Match(stderr, @"Noise floor dB:\s*(-?\d+\.?\d*)");
        var silenceMatch = Regex.Match(stderr, @"Number of samples:\s*(\d+).*?Number of NaN:.*?Silence:\s*(\d+\.?\d*)", RegexOptions.Singleline);

        var peak = peakMatch.Success ? double.Parse(peakMatch.Groups[1].Value, CultureInfo.InvariantCulture) : -3;
        var rms = rmsMatch.Success ? double.Parse(rmsMatch.Groups[1].Value, CultureInfo.InvariantCulture) : -18;
        var noise = noiseMatch.Success ? double.Parse(noiseMatch.Groups[1].Value, CultureInfo.InvariantCulture) : -70;

        return new DynamicsAnalysis
        {
            DynamicRange = Math.Abs(peak - rms),
            NoiseFloor = noise,
            SilenceRatio = 0.02, // Simplified
        };
    }

    private async Task<LoudnessAnalysis> AnalyzeLoudness(string path, CancellationToken ct)
    {
        var stderr = await RunFFmpeg($"-i \"{path}\" -af volumedetect -f null -", ct);

        var meanMatch = Regex.Match(stderr, @"mean_volume:\s*(-?\d+\.?\d*)\s*dB");
        var maxMatch = Regex.Match(stderr, @"max_volume:\s*(-?\d+\.?\d*)\s*dB");

        return new LoudnessAnalysis
        {
            MeanRms = meanMatch.Success ? double.Parse(meanMatch.Groups[1].Value, CultureInfo.InvariantCulture) : -18,
            Peak = maxMatch.Success ? double.Parse(maxMatch.Groups[1].Value, CultureInfo.InvariantCulture) : -1,
        };
    }

    private async Task<AudioInfo> GetAudioInfo(string path, CancellationToken ct)
    {
        var stdout = await RunProcess(_ffprobePath,
            $"-v quiet -print_format json -show_format -show_streams \"{path}\"", ct, readStdout: true);

        double duration = 0; int sampleRate = 44100; int channels = 2; string codec = "unknown";
        try
        {
            using var doc = JsonDocument.Parse(stdout);
            if (doc.RootElement.TryGetProperty("format", out var fmt) && fmt.TryGetProperty("duration", out var dur))
                double.TryParse(dur.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out duration);
            if (doc.RootElement.TryGetProperty("streams", out var streams))
                foreach (var s in streams.EnumerateArray())
                    if (s.TryGetProperty("codec_type", out var ct2) && ct2.GetString() == "audio")
                    {
                        if (s.TryGetProperty("sample_rate", out var sr)) int.TryParse(sr.GetString(), out sampleRate);
                        if (s.TryGetProperty("channels", out var ch)) channels = ch.GetInt32();
                        if (s.TryGetProperty("codec_name", out var cn)) codec = cn.GetString() ?? "unknown";
                        break;
                    }
        }
        catch { }

        return new AudioInfo { Duration = duration, SampleRate = sampleRate, Channels = channels, Codec = codec };
    }

    // ── Recommendation logic ──

    private static string DeterminePreset(SpectrumAnalysis spectrum, DynamicsAnalysis dynamics, LoudnessAnalysis loudness)
    {
        // Heavy bass + loud → Hip-Hop or EDM
        if (spectrum.LowEnergy > 0.4 && loudness.MeanRms > -12)
            return spectrum.HighEnergy > 0.25 ? "edm" : "hiphop";

        // Very dynamic, quiet → Classical or Jazz
        if (dynamics.DynamicRange > 15)
            return spectrum.LowEnergy > 0.3 ? "jazz" : "classical";

        // Vocal-forward, moderate loudness → Pop
        if (spectrum.MidEnergy > 0.35 && spectrum.HighEnergy > 0.2)
            return "pop";

        // Mid-heavy, punchy → Rock
        if (spectrum.MidEnergy > 0.35 && loudness.MeanRms > -14)
            return "rock";

        // Bright track
        if (spectrum.HighEnergy > 0.3)
            return "bright";

        // Warm track
        if (spectrum.LowEnergy > 0.35)
            return "warm";

        // Loud track
        if (loudness.MeanRms > -10)
            return "loud";

        return "balanced";
    }

    private static (double Low, double Mid, double High) CalculateEqRecommendation(SpectrumAnalysis spectrum)
    {
        // Suggest EQ corrections to balance the mix
        double low = 0, mid = 0, high = 0;

        // If too bass-heavy, cut low; if lacking bass, boost
        if (spectrum.LowEnergy > 0.4) low = -2;
        else if (spectrum.LowEnergy < 0.2) low = 3;

        // Mid correction
        if (spectrum.MidEnergy > 0.4) mid = -1;
        else if (spectrum.MidEnergy < 0.25) mid = 2;

        // High correction
        if (spectrum.HighEnergy > 0.35) high = -2;
        else if (spectrum.HighEnergy < 0.15) high = 3;

        return (low, mid, high);
    }

    private static int CalculateConfidence(SpectrumAnalysis spectrum, DynamicsAnalysis dynamics, LoudnessAnalysis loudness)
    {
        // Higher confidence when characteristics are clear
        int confidence = 50;
        if (spectrum.LowEnergy > 0.35 || spectrum.LowEnergy < 0.2) confidence += 10;
        if (spectrum.HighEnergy > 0.3 || spectrum.HighEnergy < 0.15) confidence += 10;
        if (dynamics.DynamicRange > 12 || dynamics.DynamicRange < 6) confidence += 10;
        if (loudness.MeanRms > -10 || loudness.MeanRms < -20) confidence += 10;
        return Math.Min(95, confidence);
    }

    private static string BuildSummary(MasteringRecommendation rec)
    {
        var parts = new List<string>();
        parts.Add($"Recommended preset: {rec.RecommendedPreset}");
        parts.Add($"Target: {rec.RecommendedLufs} LUFS ({rec.RecommendedLoudnessTarget})");

        if (rec.DeBreath || rec.DeNoise || rec.DeEss)
        {
            var vocal = new List<string>();
            if (rec.DeBreath) vocal.Add("breath removal");
            if (rec.DeNoise) vocal.Add("noise reduction");
            if (rec.DeEss) vocal.Add("de-essing");
            parts.Add($"Vocal processing: {string.Join(", ", vocal)}");
        }

        if (rec.LowEq != 0 || rec.MidEq != 0 || rec.HighEq != 0)
            parts.Add($"EQ correction: Low {rec.LowEq:+0;-0}dB, Mid {rec.MidEq:+0;-0}dB, High {rec.HighEq:+0;-0}dB");

        return string.Join(". ", parts) + ".";
    }

    private static string DetectTrackRole(SpectrumAnalysis spectrum, string name)
    {
        var n = name.ToLowerInvariant();
        if (n.Contains("vocal") || n.Contains("vox")) return "vocals";
        if (n.Contains("drum") || n.Contains("beat") || n.Contains("kick") || n.Contains("snare")) return "drums";
        if (n.Contains("bass")) return "bass";
        if (n.Contains("guitar") || n.Contains("gtr")) return "guitar";
        if (n.Contains("piano") || n.Contains("keys") || n.Contains("synth")) return "keys";
        if (n.Contains("pad") || n.Contains("string")) return "pad";

        // Detect by frequency content
        if (spectrum.LowEnergy > 0.5) return "bass";
        if (spectrum.MidEnergy > 0.4 && spectrum.HighEnergy > 0.2) return "vocals";
        if (spectrum.HighEnergy > 0.35) return "keys";
        return "other";
    }

    private static string GetEqPresetForRole(string role) => role switch
    {
        "vocals" => "vocal",
        "drums" => "drums",
        "bass" => "bass",
        "guitar" => "guitar",
        "keys" => "keys",
        _ => "none",
    };

    private static void AssignPanPositions(List<TrackAnalysis> tracks)
    {
        // Professional pan rules:
        // Vocals, bass, kick → center
        // Guitars → slight L/R
        // Keys/pads → wider L/R
        // Others → spread evenly
        foreach (var t in tracks)
        {
            t.RecommendedPan = t.Role switch
            {
                "vocals" => 0.0,
                "bass" => 0.0,
                "drums" => 0.0,
                "guitar" => tracks.IndexOf(t) % 2 == 0 ? -0.4 : 0.4,
                "keys" => tracks.IndexOf(t) % 2 == 0 ? -0.6 : 0.6,
                "pad" => tracks.IndexOf(t) % 2 == 0 ? -0.7 : 0.7,
                _ => (tracks.IndexOf(t) - tracks.Count / 2.0) / tracks.Count * 0.8,
            };
            t.RecommendedPan = Math.Round(t.RecommendedPan, 2);
        }
    }

    // ── Process runners ──

    private async Task<string> RunFFmpeg(string args, CancellationToken ct)
    {
        return await RunProcess(_ffmpegPath, args, ct, readStdout: false);
    }

    private static async Task<string> RunProcess(string fileName, string args, CancellationToken ct, bool readStdout = false)
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
                CreateNoWindow = true,
            }
        };
        process.Start();
        var stdout = await process.StandardOutput.ReadToEndAsync(ct);
        var stderr = await process.StandardError.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);
        return readStdout ? stdout : stderr;
    }

    // ── Models ──

    private record SpectrumAnalysis { public double LowEnergy; public double MidEnergy; public double HighEnergy; public double SibilanceEnergy; }
    private record DynamicsAnalysis { public double DynamicRange; public double NoiseFloor; public double SilenceRatio; }
    private record LoudnessAnalysis { public double MeanRms; public double Peak; }
    private record AudioInfo { public double Duration; public int SampleRate; public int Channels; public string Codec; }
}

public class MasteringRecommendation
{
    public double Duration { get; set; }
    public int SampleRate { get; set; }
    public int Channels { get; set; }
    public string Codec { get; set; } = "";

    public double MeanLoudness { get; set; }
    public double PeakLevel { get; set; }
    public double DynamicRange { get; set; }
    public double NoiseFloor { get; set; }
    public FrequencyBalance FrequencyBalance { get; set; } = new();

    public List<string> Characteristics { get; set; } = new();

    public string RecommendedPreset { get; set; } = "balanced";
    public int RecommendedLufs { get; set; } = -14;
    public string RecommendedLoudnessTarget { get; set; } = "spotify";
    public bool DeBreath { get; set; }
    public bool DeNoise { get; set; }
    public bool DeEss { get; set; }
    public double LowEq { get; set; }
    public double MidEq { get; set; }
    public double HighEq { get; set; }

    public int Confidence { get; set; }
    public string Summary { get; set; } = "";
}

public class FrequencyBalance
{
    public double Low { get; set; }
    public double Mid { get; set; }
    public double High { get; set; }
}

public class MixingRecommendation
{
    public List<TrackAnalysis> Tracks { get; set; } = new();
    public string Summary { get; set; } = "";
}

public class TrackAnalysis
{
    public string Name { get; set; } = "";
    public string Role { get; set; } = "other";
    public double MeanLoudness { get; set; }
    public double RecommendedVolume { get; set; } = 1.0;
    public double RecommendedPan { get; set; }
    public string RecommendedEqPreset { get; set; } = "none";
    public FrequencyBalance FrequencyBalance { get; set; } = new();
}
