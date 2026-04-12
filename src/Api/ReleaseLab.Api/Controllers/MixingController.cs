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

        track.Project.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { track.Id, track.Name, track.Volume, track.Pan, track.Muted, track.Solo });
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
}

public record CreateMixProjectRequest(string? Name);
public record AddTrackRequest(Guid FileId, string? Name);
public record UpdateTrackRequest(double? Volume, double? Pan, bool? Muted, bool? Solo, string? Name);
