using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/mix")]
public class MixingController : ControllerBase
{
    private readonly IAppDbContext _db;

    public MixingController(IAppDbContext db)
    {
        _db = db;
    }

    [HttpPost("projects")]
    public async Task<IActionResult> CreateProject([FromBody] CreateMixProjectRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var project = new MixProject
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = request.Name ?? "Untitled Mix",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _db.MixProjects.Add(project);
        await _db.SaveChangesAsync();

        return Created($"/api/v1/mix/projects/{project.Id}", new
        {
            project.Id, project.Name, project.Status, project.CreatedAt
        });
    }

    [HttpGet("projects")]
    public async Task<IActionResult> ListProjects()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var projects = await _db.MixProjects
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.UpdatedAt)
            .Select(p => new
            {
                p.Id, p.Name, p.Status, p.Progress,
                TrackCount = p.Tracks.Count,
                p.CreatedAt, p.UpdatedAt
            })
            .ToListAsync();

        return Ok(projects);
    }

    [HttpGet("projects/{id:guid}")]
    public async Task<IActionResult> GetProject(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var project = await _db.MixProjects
            .Include(p => p.Tracks)
            .ThenInclude(t => t.File)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);

        if (project is null) return NotFound();

        return Ok(new
        {
            project.Id, project.Name, project.Status, project.Progress,
            project.OutputS3Key, project.ErrorMessage,
            Tracks = project.Tracks.OrderBy(t => t.OrderIndex).Select(t => new
            {
                t.Id, t.Name, t.Volume, t.Pan, t.Muted, t.Solo, t.OrderIndex,
                File = new { t.File.Id, t.File.S3Key, t.File.Format, t.File.DurationSec, t.File.SizeBytes }
            }),
            project.CreatedAt, project.UpdatedAt
        });
    }

    [HttpPost("projects/{id:guid}/tracks")]
    public async Task<IActionResult> AddTrack(Guid id, [FromBody] AddTrackRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var project = await _db.MixProjects.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
        if (project is null) return NotFound();

        var file = await _db.Files.FindAsync(request.FileId);
        if (file is null || file.UserId != userId) return NotFound(new { message = "File not found" });

        var trackCount = await _db.MixTracks.CountAsync(t => t.MixProjectId == id);

        var track = new MixTrack
        {
            Id = Guid.NewGuid(),
            MixProjectId = id,
            FileId = request.FileId,
            Name = request.Name ?? file.Format,
            OrderIndex = trackCount,
            CreatedAt = DateTime.UtcNow,
        };

        _db.MixTracks.Add(track);
        project.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { track.Id, track.Name, track.Volume, track.Pan, track.Muted, track.OrderIndex });
    }

    [HttpPut("projects/{projectId:guid}/tracks/{trackId:guid}")]
    public async Task<IActionResult> UpdateTrack(Guid projectId, Guid trackId, [FromBody] UpdateTrackRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var track = await _db.MixTracks
            .Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == trackId && t.MixProjectId == projectId && t.Project.UserId == userId);

        if (track is null) return NotFound();

        if (request.Volume.HasValue) track.Volume = Math.Clamp(request.Volume.Value, 0, 2);
        if (request.Pan.HasValue) track.Pan = Math.Clamp(request.Pan.Value, -1, 1);
        if (request.Muted.HasValue) track.Muted = request.Muted.Value;
        if (request.Solo.HasValue) track.Solo = request.Solo.Value;
        if (request.Name is not null) track.Name = request.Name;
        if (request.Color is not null) track.Color = request.Color;
        if (request.EqPreset is not null) track.EqPreset = request.EqPreset;
        if (request.LowGain.HasValue) track.LowGain = Math.Clamp(request.LowGain.Value, -12, 12);
        if (request.MidGain.HasValue) track.MidGain = Math.Clamp(request.MidGain.Value, -12, 12);
        if (request.HighGain.HasValue) track.HighGain = Math.Clamp(request.HighGain.Value, -12, 12);
        if (request.ReverbAmount.HasValue) track.ReverbAmount = Math.Clamp(request.ReverbAmount.Value, 0, 1);
        if (request.CompressorThreshold.HasValue) track.CompressorThreshold = Math.Clamp(request.CompressorThreshold.Value, -60, 0);

        track.Project.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(MapTrack(track));
    }

    [HttpDelete("projects/{projectId:guid}/tracks/{trackId:guid}")]
    public async Task<IActionResult> RemoveTrack(Guid projectId, Guid trackId)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var track = await _db.MixTracks
            .Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == trackId && t.MixProjectId == projectId && t.Project.UserId == userId);

        if (track is null) return NotFound();

        _db.MixTracks.Remove(track);
        track.Project.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("projects/{id:guid}/export")]
    public async Task<IActionResult> ExportMixdown(Guid id, [FromServices] Services.MixdownService mixdown)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        try
        {
            var outputKey = await mixdown.ExportMixdownAsync(id, userId);
            var storage = HttpContext.RequestServices.GetRequiredService<IStorageService>();
            var downloadUrl = await storage.GeneratePresignedDownloadUrlAsync("releaselab-processed", outputKey);
            return Ok(new { outputKey, downloadUrl });
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("projects/{id:guid}/auto-mix")]
    public async Task<IActionResult> AutoMix(Guid id, [FromServices] Services.MixdownService mixdown)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        try
        {
            await mixdown.AutoMixAsync(id, userId);
            // Return updated project with new track settings
            var project = await _db.MixProjects
                .Include(p => p.Tracks)
                .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            return Ok(new
            {
                message = "Auto-mix applied",
                tracks = project!.Tracks.OrderBy(t => t.OrderIndex).Select(t => new
                {
                    t.Id, t.Name, t.Volume, t.Pan, t.Muted, t.Solo
                })
            });
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("projects/{id:guid}/reorder")]
    public async Task<IActionResult> ReorderTracks(Guid id, [FromBody] ReorderRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var project = await _db.MixProjects
            .Include(p => p.Tracks)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
        if (project is null) return NotFound();

        foreach (var item in request.Order)
        {
            var track = project.Tracks.FirstOrDefault(t => t.Id == item.TrackId);
            if (track is not null) track.OrderIndex = item.Index;
        }

        project.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Tracks reordered" });
    }

    [HttpPost("projects/{id:guid}/duplicate")]
    public async Task<IActionResult> DuplicateProject(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var source = await _db.MixProjects
            .Include(p => p.Tracks)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
        if (source is null) return NotFound();

        var newProject = new Domain.Entities.MixProject
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = $"{source.Name} (Copy)",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        foreach (var t in source.Tracks)
        {
            newProject.Tracks.Add(new Domain.Entities.MixTrack
            {
                Id = Guid.NewGuid(),
                MixProjectId = newProject.Id,
                FileId = t.FileId,
                Name = t.Name,
                Volume = t.Volume,
                Pan = t.Pan,
                Muted = t.Muted,
                Solo = t.Solo,
                OrderIndex = t.OrderIndex,
                Color = t.Color,
                EqPreset = t.EqPreset,
                LowGain = t.LowGain,
                MidGain = t.MidGain,
                HighGain = t.HighGain,
                ReverbAmount = t.ReverbAmount,
                CompressorThreshold = t.CompressorThreshold,
                CreatedAt = DateTime.UtcNow,
            });
        }

        _db.MixProjects.Add(newProject);
        await _db.SaveChangesAsync();

        return Created($"/api/v1/mix/projects/{newProject.Id}", new
        {
            newProject.Id, newProject.Name, newProject.Status, TrackCount = newProject.Tracks.Count
        });
    }

    [HttpGet("eq-presets")]
    public IActionResult ListEqPresets()
    {
        var presets = new[]
        {
            new { id = "none", name = "None", low = 0, mid = 0, high = 0 },
            new { id = "vocal", name = "Vocal Boost", low = -2, mid = 3, high = 2 },
            new { id = "drums", name = "Drums Punch", low = 3, mid = -1, high = 2 },
            new { id = "bass", name = "Bass Heavy", low = 6, mid = -2, high = -1 },
            new { id = "guitar", name = "Guitar Clarity", low = -1, mid = 2, high = 3 },
            new { id = "keys", name = "Keys/Piano", low = 0, mid = 1, high = 2 },
            new { id = "bright", name = "Bright Air", low = -2, mid = 0, high = 5 },
            new { id = "warm", name = "Warm Body", low = 3, mid = 1, high = -3 },
        };
        return Ok(presets);
    }

    private static object MapTrack(Domain.Entities.MixTrack t) => new
    {
        t.Id, t.Name, t.Volume, t.Pan, t.Muted, t.Solo, t.OrderIndex,
        t.Color, t.EqPreset, t.LowGain, t.MidGain, t.HighGain,
        t.ReverbAmount, t.CompressorThreshold,
    };
}

public record CreateMixProjectRequest(string? Name);
public record AddTrackRequest(Guid FileId, string? Name);
public record UpdateTrackRequest(
    double? Volume, double? Pan, bool? Muted, bool? Solo, string? Name,
    string? Color, string? EqPreset, double? LowGain, double? MidGain, double? HighGain,
    double? ReverbAmount, double? CompressorThreshold);
public record ReorderRequest(ReorderItem[] Order);
public record ReorderItem(Guid TrackId, int Index);
