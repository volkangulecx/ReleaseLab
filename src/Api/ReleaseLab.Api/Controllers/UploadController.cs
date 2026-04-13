using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Application.Uploads.DTOs;
using ReleaseLab.Domain.Entities;
using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/uploads")]
[EnableRateLimiting("upload")]
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
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return Unauthorized();

        // Validate by content type OR file extension
        var allowedTypes = new[] { "audio/wav", "audio/x-wav", "audio/mpeg", "audio/flac", "audio/x-flac", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg" };
        var allowedExts = new[] { ".wav", ".mp3", ".flac", ".m4a", ".aac", ".ogg" };
        var fileExt = Path.GetExtension(request.FileName)?.ToLowerInvariant() ?? "";
        var contentType = request.ContentType?.ToLowerInvariant() ?? "";

        var mimeOk = allowedTypes.Contains(contentType);
        var extOk = allowedExts.Contains(fileExt);

        if (!mimeOk && !extOk)
            return BadRequest(new { message = "Unsupported audio format. Use WAV, MP3, or FLAC." });

        // Resolve content type from extension if browser sent empty/generic
        if (!mimeOk && extOk)
        {
            contentType = fileExt switch
            {
                ".wav" => "audio/wav",
                ".mp3" => "audio/mpeg",
                ".flac" => "audio/flac",
                ".m4a" => "audio/mp4",
                ".aac" => "audio/aac",
                ".ogg" => "audio/ogg",
                _ => "application/octet-stream"
            };
        }

        // Plan-based file size limit
        var maxSize = Application.Interfaces.PlanLimits.MaxFileSizeBytes(user.Plan);
        if (request.SizeBytes > maxSize)
            return BadRequest(new { message = $"File too large (max {maxSize / 1024 / 1024}MB for your plan)" });

        var fileId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var s3Key = $"{userId}/{now:yyyy}/{now:MM}/{fileId}{GetExtension(contentType)}";

        var uploadUrl = await _storage.GeneratePresignedUploadUrlAsync(RawBucket, s3Key, contentType);

        var file = new AudioFile
        {
            Id = fileId,
            UserId = userId,
            S3Key = s3Key,
            Kind = FileKind.Raw,
            Format = GetFormat(contentType),
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

        // Try to detect audio duration via analysis service
        try
        {
            var analysis = HttpContext.RequestServices.GetService<IAudioAnalysisService>();
            if (analysis is not null)
            {
                var minio = HttpContext.RequestServices.GetRequiredService<Minio.IMinioClient>();
                var tempPath = Path.Combine(Path.GetTempPath(), "releaselab-probe", $"{file.Id}{Path.GetExtension(file.S3Key)}");
                Directory.CreateDirectory(Path.GetDirectoryName(tempPath)!);

                await minio.GetObjectAsync(new Minio.DataModel.Args.GetObjectArgs()
                    .WithBucket(RawBucket)
                    .WithObject(file.S3Key)
                    .WithCallbackStream(async (stream, ct) =>
                    {
                        using var fs = System.IO.File.Create(tempPath);
                        await stream.CopyToAsync(fs, ct);
                    }));

                var result = await analysis.AnalyzeAsync(tempPath);
                file.DurationSec = (int)Math.Round(result.DurationSeconds);

                try { System.IO.File.Delete(tempPath); } catch { }
            }
        }
        catch { /* Duration detection is best-effort */ }

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
