using Microsoft.AspNetCore.Mvc;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Route("api/v1/presets")]
public class GenrePresetsController : ControllerBase
{
    [HttpGet("genres")]
    public IActionResult ListGenrePresets()
    {
        var presets = new[]
        {
            new { id = "hiphop", name = "Hip-Hop", description = "Heavy low-end, punchy drums, vocal presence", targetLufs = -9 },
            new { id = "edm", name = "EDM / Electronic", description = "Wide stereo, powerful subs, crisp highs", targetLufs = -8 },
            new { id = "jazz", name = "Jazz", description = "Natural dynamics, warm mids, open soundstage", targetLufs = -16 },
            new { id = "classical", name = "Classical", description = "Maximum dynamic range, pristine clarity", targetLufs = -18 },
            new { id = "pop", name = "Pop", description = "Radio-ready, vocal-forward, balanced", targetLufs = -11 },
            new { id = "rock", name = "Rock", description = "Aggressive midrange, tight low-end, energy", targetLufs = -10 },
        };
        return Ok(presets);
    }
}
