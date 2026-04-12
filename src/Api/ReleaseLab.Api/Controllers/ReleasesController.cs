using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/releases")]
public class ReleasesController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly IStorageService _storage;

    public ReleasesController(IAppDbContext db, IStorageService storage)
    {
        _db = db;
        _storage = storage;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateReleaseRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var release = new Release
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            JobId = request.JobId,
            MixProjectId = request.MixProjectId,
            Title = request.Title,
            Artist = request.Artist,
            Album = request.Album,
            Genre = request.Genre,
            Year = request.Year ?? DateTime.UtcNow.Year,
            Language = request.Language ?? "en",
            Copyright = request.Copyright ?? $"© {DateTime.UtcNow.Year} {request.Artist}",
            AudioS3Key = request.AudioS3Key,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _db.Releases.Add(release);
        await _db.SaveChangesAsync();

        return Created($"/api/v1/releases/{release.Id}", MapToResponse(release));
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var releases = await _db.Releases
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.UpdatedAt)
            .ToListAsync();

        return Ok(releases.Select(MapToResponse));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var release = await _db.Releases.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
        if (release is null) return NotFound();
        return Ok(MapToResponse(release));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReleaseRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var release = await _db.Releases.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
        if (release is null) return NotFound();

        if (release.Status is "submitted" or "live")
            return BadRequest(new { message = "Cannot edit a submitted/live release" });

        if (request.Title is not null) release.Title = request.Title;
        if (request.Artist is not null) release.Artist = request.Artist;
        if (request.Album is not null) release.Album = request.Album;
        if (request.Genre is not null) release.Genre = request.Genre;
        if (request.Isrc is not null) release.Isrc = request.Isrc;
        if (request.Upc is not null) release.Upc = request.Upc;
        if (request.Year.HasValue) release.Year = request.Year.Value;
        if (request.Language is not null) release.Language = request.Language;
        if (request.Copyright is not null) release.Copyright = request.Copyright;
        if (request.Description is not null) release.Description = request.Description;
        if (request.ArtworkS3Key is not null) release.ArtworkS3Key = request.ArtworkS3Key;
        if (request.ScheduledReleaseDate.HasValue) release.ScheduledReleaseDate = request.ScheduledReleaseDate;
        if (request.Spotify.HasValue) release.Spotify = request.Spotify.Value;
        if (request.AppleMusic.HasValue) release.AppleMusic = request.AppleMusic.Value;
        if (request.YouTube.HasValue) release.YouTube = request.YouTube.Value;
        if (request.AmazonMusic.HasValue) release.AmazonMusic = request.AmazonMusic.Value;
        if (request.Tidal.HasValue) release.Tidal = request.Tidal.Value;
        if (request.Deezer.HasValue) release.Deezer = request.Deezer.Value;

        release.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(MapToResponse(release));
    }

    [HttpPost("{id:guid}/artwork")]
    public async Task<IActionResult> UploadArtwork(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var release = await _db.Releases.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
        if (release is null) return NotFound();

        var s3Key = $"{userId}/releases/{release.Id}/artwork.jpg";
        var uploadUrl = await _storage.GeneratePresignedUploadUrlAsync("releaselab-processed", s3Key, "image/jpeg");

        release.ArtworkS3Key = s3Key;
        release.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { uploadUrl, s3Key });
    }

    [HttpPost("{id:guid}/schedule")]
    public async Task<IActionResult> Schedule(Guid id, [FromBody] ScheduleRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var release = await _db.Releases.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
        if (release is null) return NotFound();

        if (string.IsNullOrEmpty(release.Title) || string.IsNullOrEmpty(release.Artist))
            return BadRequest(new { message = "Title and Artist are required" });

        if (string.IsNullOrEmpty(release.AudioS3Key))
            return BadRequest(new { message = "Audio file is required" });

        if (request.ReleaseDate <= DateTime.UtcNow.AddDays(1))
            return BadRequest(new { message = "Release date must be at least 24 hours in the future" });

        release.ScheduledReleaseDate = request.ReleaseDate;
        release.Status = "scheduled";
        release.DistributorId = request.Distributor ?? "releaselab";
        release.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(MapToResponse(release));
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var release = await _db.Releases.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
        if (release is null) return NotFound();

        if (release.Status is not ("draft" or "scheduled"))
            return BadRequest(new { message = "Can only submit draft or scheduled releases" });

        // Validate required fields
        var errors = new List<string>();
        if (string.IsNullOrEmpty(release.Title)) errors.Add("Title required");
        if (string.IsNullOrEmpty(release.Artist)) errors.Add("Artist required");
        if (string.IsNullOrEmpty(release.AudioS3Key)) errors.Add("Audio file required");
        if (string.IsNullOrEmpty(release.ArtworkS3Key)) errors.Add("Artwork required");
        if (errors.Count > 0)
            return BadRequest(new { message = "Validation failed", errors });

        release.Status = "submitted";
        release.SubmittedAt = DateTime.UtcNow;
        release.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(MapToResponse(release));
    }

    private static object MapToResponse(Release r) => new
    {
        r.Id, r.Title, r.Artist, r.Album, r.Genre, r.Isrc, r.Upc,
        r.Year, r.Language, r.Copyright, r.Description,
        r.ArtworkS3Key, r.AudioS3Key,
        r.Status, r.DistributorId, r.ExternalReleaseId,
        r.ScheduledReleaseDate, r.SubmittedAt, r.LiveAt,
        Platforms = new { r.Spotify, r.AppleMusic, r.YouTube, r.AmazonMusic, r.Tidal, r.Deezer },
        r.CreatedAt, r.UpdatedAt,
    };
}

public record CreateReleaseRequest(
    string Title, string Artist, string? Album, string? Genre,
    int? Year, string? Language, string? Copyright,
    string? AudioS3Key, Guid? JobId, Guid? MixProjectId);

public record UpdateReleaseRequest(
    string? Title, string? Artist, string? Album, string? Genre,
    string? Isrc, string? Upc, int? Year, string? Language,
    string? Copyright, string? Description, string? ArtworkS3Key,
    DateTime? ScheduledReleaseDate,
    bool? Spotify, bool? AppleMusic, bool? YouTube,
    bool? AmazonMusic, bool? Tidal, bool? Deezer);

public record ScheduleRequest(DateTime ReleaseDate, string? Distributor);
