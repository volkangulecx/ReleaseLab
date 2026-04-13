using System.Globalization;
using ReleaseLab.Contracts.Messages;

namespace ReleaseLab.Worker.Mastering;

/// <summary>
/// Professional mastering chain — broadcast/streaming quality.
/// Multi-stage processing: cleanup → EQ → compression → stereo → loudnorm → limiter
/// </summary>
public static class ProMasteringChain
{
    private static readonly CultureInfo IC = CultureInfo.InvariantCulture;

    public static string Build(MasteringJobMessage msg)
    {
        var preset = msg.Preset.ToLowerInvariant();
        var filters = new List<string>();

        // ── Stage 1: Cleanup ──
        filters.Add("highpass=f=22");

        if (msg.DeNoise)
        {
            filters.Add("highpass=f=75");
            filters.Add("afftdn=nf=-20:nt=w");
        }

        if (msg.DeBreath)
            filters.Add("agate=threshold=0.015:ratio=10:attack=0.5:release=80:range=0.03");

        // ── Stage 2: Professional Multi-band EQ ──
        foreach (var band in GetProEq(preset))
            filters.Add($"equalizer=f={band.freq}:width_type=o:width={band.q.ToString("F1", IC)}:g={band.gain.ToString("F1", IC)}");

        // Custom EQ overlay
        if (msg.LowEq.HasValue && Math.Abs(msg.LowEq.Value) > 0.1)
            filters.Add($"equalizer=f=150:width_type=o:width=1.5:g={msg.LowEq.Value.ToString("F1", IC)}");
        if (msg.MidEq.HasValue && Math.Abs(msg.MidEq.Value) > 0.1)
            filters.Add($"equalizer=f=2500:width_type=o:width=1.5:g={msg.MidEq.Value.ToString("F1", IC)}");
        if (msg.HighEq.HasValue && Math.Abs(msg.HighEq.Value) > 0.1)
            filters.Add($"equalizer=f=10000:width_type=o:width=1.5:g={msg.HighEq.Value.ToString("F1", IC)}");

        // De-ess
        if (msg.DeEss)
            filters.Add("firequalizer=gain_entry='entry(0,0);entry(3500,0);entry(5000,-5);entry(7000,-7);entry(9000,-4);entry(11000,0)'");

        // ── Stage 3: Professional Compression ──
        var comp = GetProCompression(preset);
        filters.Add($"acompressor=threshold={comp.threshold}dB:ratio={comp.ratio.ToString("F1", IC)}:attack={comp.attack}:release={comp.release}:makeup={comp.makeup}");

        // ── Stage 4: Stereo Enhancement ──
        var stereo = GetProStereo(preset);
        if (stereo > 1.0)
            filters.Add($"extrastereo=m={stereo.ToString("F2", IC)}");

        // ── Stage 5: Loudness Normalization (EBU R128) ──
        var targetLufs = ResolveTargetLufs(msg, preset);
        var lra = GetProLra(preset);
        filters.Add($"loudnorm=I={targetLufs}:TP=-1.0:LRA={lra}");

        // ── Stage 6: True Peak Limiter ──
        filters.Add("alimiter=limit=0.89:attack=0.1:release=50");

        return string.Join(",", filters);
    }

    private static int ResolveTargetLufs(MasteringJobMessage msg, string preset)
    {
        if (msg.LoudnessTarget is not null)
        {
            return msg.LoudnessTarget.ToLowerInvariant() switch
            {
                "spotify" => -14,
                "apple" => -16,
                "youtube" => -13,
                "club" => -8,
                "custom" => (int)(msg.CustomLufs ?? -14),
                _ => GetDefaultLufs(preset),
            };
        }
        return GetDefaultLufs(preset);
    }

    private static int GetDefaultLufs(string preset) => preset switch
    {
        "loud" => -9, "hiphop" => -9, "edm" => -8, "club" => -8,
        "jazz" => -16, "classical" => -18,
        "pop" => -11, "rock" => -10,
        _ => -14,
    };

    private static (int freq, double q, double gain)[] GetProEq(string preset) => preset switch
    {
        "warm" => [(60, 1.2, 1.5), (200, 1.5, 2.0), (800, 2.0, -1.0), (3000, 1.5, -0.5), (12000, 1.0, -1.5)],
        "bright" => [(60, 1.5, 0.5), (250, 2.0, -1.0), (3000, 1.5, 1.5), (8000, 1.2, 2.5), (14000, 0.8, 2.0)],
        "loud" => [(50, 1.0, 3.0), (100, 1.5, 2.0), (500, 2.0, -1.5), (3000, 1.5, 1.5), (10000, 1.0, 2.0)],
        "hiphop" => [(45, 0.8, 4.0), (100, 1.5, 2.5), (400, 2.0, -2.0), (2500, 1.5, 2.0), (8000, 1.2, 1.5)],
        "edm" => [(40, 0.7, 3.5), (150, 2.0, -1.5), (2000, 2.0, -1.0), (6000, 1.5, 2.5), (14000, 0.8, 3.0)],
        "jazz" => [(80, 1.5, 1.0), (250, 2.0, 0.5), (1500, 2.0, 0.5), (5000, 1.5, -0.5), (12000, 1.0, 1.0)],
        "classical" => [(60, 2.0, 0.3), (300, 2.0, 0.3), (2000, 2.0, 0.2), (6000, 1.5, 0.5), (14000, 0.8, 0.8)],
        "pop" => [(80, 1.5, 1.5), (250, 2.0, -0.5), (2000, 1.2, 2.0), (5000, 1.5, 1.5), (12000, 1.0, 2.0)],
        "rock" => [(60, 1.2, 2.5), (300, 2.0, 1.0), (1000, 1.5, 1.5), (3500, 1.5, 1.5), (10000, 1.0, 1.5)],
        _ => [(80, 1.5, 0.5), (500, 2.0, -0.3), (2500, 1.5, 0.5), (8000, 1.2, 0.5), (14000, 1.0, 0.5)], // balanced
    };

    private static (int threshold, double ratio, int attack, int release, int makeup) GetProCompression(string preset) => preset switch
    {
        "warm" => (-18, 2.5, 15, 250, 2),
        "bright" => (-16, 2.0, 10, 200, 1),
        "loud" => (-12, 4.0, 3, 100, 4),
        "hiphop" => (-14, 3.5, 5, 120, 3),
        "edm" => (-10, 4.5, 1, 80, 5),
        "jazz" => (-24, 1.5, 30, 400, 1),
        "classical" => (-28, 1.2, 50, 500, 0),
        "pop" => (-16, 3.0, 8, 180, 2),
        "rock" => (-14, 3.5, 5, 150, 3),
        _ => (-18, 2.0, 12, 200, 1),
    };

    private static double GetProStereo(string preset) => preset switch
    {
        "warm" => 1.15, "bright" => 1.30, "loud" => 1.10,
        "hiphop" => 1.10, "edm" => 1.50, "jazz" => 1.20,
        "classical" => 1.05, "pop" => 1.25, "rock" => 1.15,
        _ => 1.10,
    };

    private static int GetProLra(string preset) => preset switch
    {
        "loud" => 6, "hiphop" => 7, "edm" => 5, "club" => 5,
        "jazz" => 14, "classical" => 16,
        "pop" => 8, "rock" => 7,
        _ => 10,
    };
}
