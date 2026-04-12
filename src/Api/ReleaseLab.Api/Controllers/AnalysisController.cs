using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Interfaces;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/analysis")]
public class AnalysisController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly IStorageService _storage;
    private readonly IAudioAnalysisService _analysis;

    public AnalysisController(IAppDbContext db, IStorageService storage, IAudioAnalysisService analysis)
    {
        _db = db;
        _storage = storage;
        _analysis = analysis;
    }

    [HttpGet("job/{jobId:guid}")]
    public async Task<IActionResult> AnalyzeJob(Guid jobId, [FromQuery] string type = "input")
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var job = await _db.Jobs
            .Include(j => j.InputFile)
            .FirstOrDefaultAsync(j => j.Id == jobId && j.UserId == userId);

        if (job is null) return NotFound();

        string bucket, s3Key;

        if (type == "output")
        {
            if (job.Status != Domain.Enums.JobStatus.Completed)
                return BadRequest(new { message = "Job not completed yet" });
            bucket = "releaselab-processed";
            s3Key = $"{userId}/{job.Id}/preview.mp3";
        }
        else
        {
            bucket = "releaselab-raw";
            s3Key = job.InputFile.S3Key;
        }

        // Download to temp for analysis
        var minio = HttpContext.RequestServices.GetRequiredService<Minio.IMinioClient>();
        var tempPath = Path.Combine(Path.GetTempPath(), "releaselab-analysis", $"{Guid.NewGuid()}{Path.GetExtension(s3Key)}");
        Directory.CreateDirectory(Path.GetDirectoryName(tempPath)!);

        try
        {
            await minio.GetObjectAsync(new Minio.DataModel.Args.GetObjectArgs()
                .WithBucket(bucket)
                .WithObject(s3Key)
                .WithCallbackStream(async (stream, ct) =>
                {
                    using var fs = System.IO.File.Create(tempPath);
                    await stream.CopyToAsync(fs, ct);
                }));

            var result = await _analysis.AnalyzeAsync(tempPath);

            return Ok(new
            {
                type,
                duration = Math.Round(result.DurationSeconds, 2),
                sampleRate = result.SampleRate,
                channels = result.Channels,
                codec = result.Codec,
                peakDb = Math.Round(result.PeakDb, 1),
                loudnessLufs = Math.Round(result.LoudnessLufs, 1),
                waveform = result.WaveformData
            });
        }
        finally
        {
            try { System.IO.File.Delete(tempPath); } catch { }
        }
    }
}
