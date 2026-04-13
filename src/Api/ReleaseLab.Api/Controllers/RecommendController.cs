using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Interfaces;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/recommend")]
public class RecommendController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly Services.AudioRecommendationService _recommend;

    public RecommendController(IAppDbContext db, Services.AudioRecommendationService recommend)
    {
        _db = db;
        _recommend = recommend;
    }

    /// <summary>
    /// Analyze an uploaded file and get mastering recommendations.
    /// </summary>
    [HttpPost("mastering/{fileId:guid}")]
    public async Task<IActionResult> RecommendMastering(Guid fileId)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var file = await _db.Files.FindAsync(fileId);
        if (file is null || file.UserId != userId) return NotFound();

        // Download to temp
        var minio = HttpContext.RequestServices.GetRequiredService<Minio.IMinioClient>();
        var tempPath = Path.Combine(Path.GetTempPath(), "releaselab-recommend", $"{fileId}{Path.GetExtension(file.S3Key)}");
        Directory.CreateDirectory(Path.GetDirectoryName(tempPath)!);

        try
        {
            // Download with timeout
            using var dlCts = new CancellationTokenSource(TimeSpan.FromMinutes(2));
            await minio.GetObjectAsync(new Minio.DataModel.Args.GetObjectArgs()
                .WithBucket("releaselab-raw")
                .WithObject(file.S3Key)
                .WithFile(tempPath), dlCts.Token);

            // Check file size — skip analysis for very large files
            var fileSize = new FileInfo(tempPath).Length;
            if (fileSize > 100 * 1024 * 1024) // 100MB limit for analysis
                return BadRequest(new { message = "File too large for analysis (max 100MB)" });

            using var analysisCts = new CancellationTokenSource(TimeSpan.FromMinutes(3));
            var recommendation = await _recommend.AnalyzeAndRecommendAsync(tempPath, analysisCts.Token);
            return Ok(recommendation);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Analysis failed: {ex.Message}" });
        }
        finally
        {
            try { System.IO.File.Delete(tempPath); } catch { }
        }
    }

    /// <summary>
    /// Analyze all tracks in a mix project and get mixing recommendations.
    /// </summary>
    [HttpPost("mixing/{projectId:guid}")]
    public async Task<IActionResult> RecommendMixing(Guid projectId)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var project = await _db.MixProjects
            .Include(p => p.Tracks).ThenInclude(t => t.File)
            .FirstOrDefaultAsync(p => p.Id == projectId && p.UserId == userId);

        if (project is null) return NotFound();
        if (project.Tracks.Count == 0) return BadRequest(new { message = "No tracks to analyze" });

        var minio = HttpContext.RequestServices.GetRequiredService<Minio.IMinioClient>();
        var tempDir = Path.Combine(Path.GetTempPath(), "releaselab-recommend-mix", projectId.ToString());
        Directory.CreateDirectory(tempDir);

        try
        {
            var tracks = new List<(string path, string name)>();
            foreach (var track in project.Tracks.OrderBy(t => t.OrderIndex))
            {
                var localPath = Path.Combine(tempDir, $"{track.Id}{Path.GetExtension(track.File.S3Key)}");
                await minio.GetObjectAsync(new Minio.DataModel.Args.GetObjectArgs()
                    .WithBucket("releaselab-raw")
                    .WithObject(track.File.S3Key)
                    .WithFile(localPath));
                tracks.Add((localPath, track.Name));
            }

            using var analysisCts = new CancellationTokenSource(TimeSpan.FromMinutes(5));
            var recommendation = await _recommend.AnalyzeTracksAndRecommendAsync(tracks, analysisCts.Token);
            return Ok(recommendation);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Analysis failed: {ex.Message}" });
        }
        finally
        {
            try { Directory.Delete(tempDir, true); } catch { }
        }
    }
}
