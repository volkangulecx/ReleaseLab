using Microsoft.AspNetCore.Mvc;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Route("api/v1/presets")]
public class GenrePresetsController : ControllerBase
{
    [HttpGet("all")]
    public IActionResult ListAllPresets()
    {
        var presets = new object[]
        {
            // Standard
            new { id = "warm", name = "Warm", category = "standard", description = "Smooth, rich low-mids. R&B, Soul, Jazz.", targetLufs = -14, stereo = 1.15, lra = 10,
                eq = new[] { new { freq = 60, gain = 1.5 }, new { freq = 200, gain = 2.0 }, new { freq = 800, gain = -1.0 }, new { freq = 3000, gain = -0.5 }, new { freq = 12000, gain = -1.5 } } },
            new { id = "bright", name = "Bright", category = "standard", description = "Crisp highs, clear presence. Pop, Indie.", targetLufs = -14, stereo = 1.30, lra = 9,
                eq = new[] { new { freq = 60, gain = 0.5 }, new { freq = 250, gain = -1.0 }, new { freq = 3000, gain = 1.5 }, new { freq = 8000, gain = 2.5 }, new { freq = 14000, gain = 2.0 } } },
            new { id = "loud", name = "Loud", category = "standard", description = "Maximum punch and energy. EDM, Hip-Hop.", targetLufs = -9, stereo = 1.10, lra = 6,
                eq = new[] { new { freq = 50, gain = 3.0 }, new { freq = 100, gain = 2.0 }, new { freq = 500, gain = -1.5 }, new { freq = 3000, gain = 1.5 }, new { freq = 10000, gain = 2.0 } } },
            new { id = "balanced", name = "Balanced", category = "standard", description = "Natural, transparent mastering.", targetLufs = -14, stereo = 1.10, lra = 10,
                eq = new[] { new { freq = 80, gain = 0.5 }, new { freq = 500, gain = -0.3 }, new { freq = 2500, gain = 0.5 }, new { freq = 8000, gain = 0.5 }, new { freq = 14000, gain = 0.5 } } },

            // Genre
            new { id = "hiphop", name = "Hip-Hop", category = "genre", description = "Heavy 808 sub, punchy kick, vocal presence.", targetLufs = -9, stereo = 1.10, lra = 7,
                eq = new[] { new { freq = 45, gain = 4.0 }, new { freq = 100, gain = 2.5 }, new { freq = 400, gain = -2.0 }, new { freq = 2500, gain = 2.0 }, new { freq = 8000, gain = 1.5 } } },
            new { id = "edm", name = "EDM", category = "genre", description = "Wide stereo, powerful subs, crisp highs.", targetLufs = -8, stereo = 1.50, lra = 5,
                eq = new[] { new { freq = 40, gain = 3.5 }, new { freq = 150, gain = -1.5 }, new { freq = 2000, gain = -1.0 }, new { freq = 6000, gain = 2.5 }, new { freq = 14000, gain = 3.0 } } },
            new { id = "jazz", name = "Jazz", category = "genre", description = "Natural dynamics, warm mids, open stage.", targetLufs = -16, stereo = 1.20, lra = 14,
                eq = new[] { new { freq = 80, gain = 1.0 }, new { freq = 250, gain = 0.5 }, new { freq = 1500, gain = 0.5 }, new { freq = 5000, gain = -0.5 }, new { freq = 12000, gain = 1.0 } } },
            new { id = "classical", name = "Classical", category = "genre", description = "Maximum dynamic range, pristine clarity.", targetLufs = -18, stereo = 1.05, lra = 16,
                eq = new[] { new { freq = 60, gain = 0.3 }, new { freq = 300, gain = 0.3 }, new { freq = 2000, gain = 0.2 }, new { freq = 6000, gain = 0.5 }, new { freq = 14000, gain = 0.8 } } },
            new { id = "pop", name = "Pop", category = "genre", description = "Radio-ready, vocal-forward, polished.", targetLufs = -11, stereo = 1.25, lra = 8,
                eq = new[] { new { freq = 80, gain = 1.5 }, new { freq = 250, gain = -0.5 }, new { freq = 2000, gain = 2.0 }, new { freq = 5000, gain = 1.5 }, new { freq = 12000, gain = 2.0 } } },
            new { id = "rock", name = "Rock", category = "genre", description = "Aggressive mids, tight low-end, energy.", targetLufs = -10, stereo = 1.15, lra = 7,
                eq = new[] { new { freq = 60, gain = 2.5 }, new { freq = 300, gain = 1.0 }, new { freq = 1000, gain = 1.5 }, new { freq = 3500, gain = 1.5 }, new { freq = 10000, gain = 1.5 } } },
        };
        return Ok(presets);
    }

    [HttpGet("loudness-targets")]
    public IActionResult LoudnessTargets()
    {
        var targets = new[]
        {
            new { id = "spotify", name = "Spotify", lufs = -14, description = "Spotify normalization standard" },
            new { id = "apple", name = "Apple Music", lufs = -16, description = "Apple Sound Check target" },
            new { id = "youtube", name = "YouTube", lufs = -13, description = "YouTube loudness normalization" },
            new { id = "club", name = "Club / DJ", lufs = -8, description = "Maximum loudness for club play" },
            new { id = "custom", name = "Custom", lufs = 0, description = "Set your own LUFS target" },
        };
        return Ok(targets);
    }

    [HttpGet("processing-chain")]
    public IActionResult ProcessingChain()
    {
        var stages = new[]
        {
            new { order = 1, name = "Cleanup", icon = "🔧", description = "DC offset removal, sub-bass high-pass filter (22Hz)", filters = new[] { "highpass" } },
            new { order = 2, name = "Noise Reduction", icon = "🔇", description = "Background noise removal (afftdn), breath gating", filters = new[] { "afftdn", "agate" } },
            new { order = 3, name = "Equalization", icon = "📊", description = "5-band professional EQ + custom overlay", filters = new[] { "equalizer" } },
            new { order = 4, name = "De-Ess", icon = "🐍", description = "Sibilance reduction in 4-10kHz range", filters = new[] { "firequalizer" } },
            new { order = 5, name = "Compression", icon = "📦", description = "Genre-optimized dynamics control", filters = new[] { "acompressor" } },
            new { order = 6, name = "Stereo Enhancement", icon = "🎧", description = "Stereo image widening", filters = new[] { "extrastereo" } },
            new { order = 7, name = "Loudness", icon = "📢", description = "EBU R128 normalization to target LUFS", filters = new[] { "loudnorm" } },
            new { order = 8, name = "True Peak Limiter", icon = "🛡️", description = "ISP protection at -1dBTP", filters = new[] { "alimiter" } },
        };
        return Ok(stages);
    }
}
