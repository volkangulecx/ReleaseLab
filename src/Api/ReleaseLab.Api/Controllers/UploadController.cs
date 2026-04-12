using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Application.Uploads.DTOs;
using ReleaseLab.Domain.Entities;
using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/uploads")]
public class UploadController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly IStorageService _storage;

    private const string RawBucket = "releaselab-raw";

    public UploadController(IAppDbContext db, IStorageService storage)
    {
        _db = db;
        _storage = storage;
    }

    [HttpPost("init")]
    public async Task<IActionResult> Init([FromBody] UploadInitRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        // Validate content type
        var allowedTypes = new[] { "audio/wav", "audio/x-wav", "audio/mpeg", "audio/flac", "audio/x-flac" };
        if (!allowedTypes.Contains(request.ContentType.ToLowerInvariant()))
            return BadRequest(new { message = "Unsupported audio format" });

        // Validate file size (50MB free, 500MB studio — simplified for MVP)
        if (request.SizeBytes > 500 * 1024 * 1024)
            return BadRequest(new { message = "File too large (max 500MB)" });

        var fileId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var s3Key = $"{userId}/{now:yyyy}/{now:MM}/{fileId}{GetExtension(request.ContentType)}";

        var uploadUrl = await _storage.GeneratePresignedUploadUrlAsync(RawBucket, s3Key, request.ContentType);

        var file = new AudioFile
        {
            Id = fileId,
            UserId = userId,
            S3Key = s3Key,
            Kind = FileKind.Raw,
            Format = GetFormat(request.ContentType),
            SizeBytes = request.SizeBytes,
            CreatedAt = now
        };

        _db.Files.Add(file);
        await _db.SaveChangesAsync();

        return Ok(new UploadInitResponse(fileId, uploadUrl));
    }

    [HttpPost("complete")]
    public async Task<IActionResult> Complete([FromBody] UploadCompleteRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var file = await _db.Files.FindAsync(request.FileId);

        if (file is null || file.UserId != userId)
            return NotFound();

        // Verify file exists in S3
        if (!await _storage.ObjectExistsAsync(RawBucket, file.S3Key))
            return BadRequest(new { message = "File not uploaded yet" });

        if (request.Checksum is not null)
            file.ChecksumSha256 = request.Checksum;

        await _db.SaveChangesAsync();

        return Ok(new { fileId = file.Id, status = "ready" });
    }

    private static string GetExtension(string contentType) => contentType.ToLowerInvariant() switch
    {
        "audio/wav" or "audio/x-wav" => ".wav",
        "audio/mpeg" => ".mp3",
        "audio/flac" or "audio/x-flac" => ".flac",
        _ => ".bin"
    };

    private static string GetFormat(string contentType) => contentType.ToLowerInvariant() switch
    {
        "audio/wav" or "audio/x-wav" => "wav",
        "audio/mpeg" => "mp3",
        "audio/flac" or "audio/x-flac" => "flac",
        _ => "unknown"
    };
}
