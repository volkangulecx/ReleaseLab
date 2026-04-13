using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Application.Jobs.DTOs;
using ReleaseLab.Contracts.Messages;
using ReleaseLab.Domain.Entities;
using ReleaseLab.Domain.Enums;
using StackExchange.Redis;
using System.Text.Json;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/jobs")]
public class JobsController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly IQueueService _queue;
    private readonly IStorageService _storage;
    private readonly IConnectionMultiplexer _redis;

    private const string ProcessedBucket = "releaselab-processed";

    public JobsController(IAppDbContext db, IQueueService queue, IStorageService storage, IConnectionMultiplexer redis)
    {
        _db = db;
        _queue = queue;
        _storage = storage;
        _redis = redis;
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateJobRequest request,
        [FromServices] ISubscriptionService subscriptions)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return Unauthorized();

        // Plan limit check
        var canCreate = await subscriptions.CanCreateMasterAsync(userId);
        if (!canCreate)
            return BadRequest(new { message = "Monthly mastering limit reached. Upgrade your plan or purchase credits." });

        var file = await _db.Files.FindAsync(request.FileId);
        if (file is null || file.UserId != userId)
            return NotFound(new { message = "File not found" });

        var validGenres = new[] { "hiphop", "edm", "jazz", "classical", "pop", "rock" };
        var isGenre = validGenres.Contains(request.Preset.ToLowerInvariant());
        if (!Enum.TryParse<MasteringPreset>(request.Preset, true, out var preset) && !isGenre)
            return BadRequest(new { message = "Invalid preset" });

        if (!Enum.TryParse<AudioQuality>(request.Quality, true, out var quality))
            return BadRequest(new { message = "Invalid quality" });

        // Credit check for HiRes
        var creditCost = quality == AudioQuality.HiRes ? 1 : 0;
        if (creditCost > 0 && user.CreditBalance < creditCost)
            return BadRequest(new { message = "Insufficient credits" });

        // Estimate processing duration based on file duration (~2x realtime for FFmpeg processing)
        var estimatedSec = file.DurationSec.HasValue ? (int)(file.DurationSec.Value * 2) + 5 : 30;

        var job = new Job
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            InputFileId = file.Id,
            Preset = preset,
            Quality = quality,
            Status = JobStatus.Queued,
            CreditsCost = creditCost,
            EstimatedDurationSec = estimatedSec,
            CreatedAt = DateTime.UtcNow
        };

        // Hold credits (deduct on completion)
        if (creditCost > 0)
        {
            user.CreditBalance -= creditCost;
            _db.CreditLedgerEntries.Add(new CreditLedgerEntry
            {
                UserId = userId,
                Delta = -creditCost,
                Reason = CreditReason.Job,
                RefJobId = job.Id,
                BalanceAfter = user.CreditBalance,
                CreatedAt = DateTime.UtcNow
            });
        }

        _db.Jobs.Add(job);
        await _db.SaveChangesAsync();

        // Track usage
        await subscriptions.IncrementUsageAsync(userId);

        // Enqueue to Redis with plan-based priority
        // Resolve preset — could be enum name OR genre string
        var presetStr = Enum.IsDefined(typeof(MasteringPreset), preset) ? preset.ToString() : request.Preset;

        await _queue.EnqueueMasteringJobAsync(new MasteringJobMessage
        {
            JobId = job.Id,
            UserId = userId,
            InputS3Key = file.S3Key,
            OutputBucket = ProcessedBucket,
            Preset = presetStr,
            Quality = quality.ToString(),
            UserPlan = user.Plan.ToString(),
            LoudnessTarget = request.LoudnessTarget,
            CustomLufs = request.CustomLufs,
            LowEq = request.LowEq,
            MidEq = request.MidEq,
            HighEq = request.HighEq,
            AttemptCount = 0,
            EnqueuedAt = DateTime.UtcNow
        }, user.Plan);

        return Created($"/api/v1/jobs/{job.Id}", MapToResponse(job));
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Jobs.Where(j => j.UserId == userId);
        var total = await query.CountAsync();

        var jobs = await query
            .OrderByDescending(j => j.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new
        {
            data = jobs.Select(MapToResponse),
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var job = await _db.Jobs.FirstOrDefaultAsync(j => j.Id == id && j.UserId == userId);
        if (job is null) return NotFound();

        return Ok(MapToResponse(job));
    }

    [HttpGet("{id:guid}/stream")]
    public async Task StreamProgress(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var job = await _db.Jobs.FirstOrDefaultAsync(j => j.Id == id && j.UserId == userId);
        if (job is null)
        {
            Response.StatusCode = 404;
            return;
        }

        Response.Headers["Content-Type"] = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["Connection"] = "keep-alive";

        var subscriber = _redis.GetSubscriber();
        var channel = RedisChannel.Literal($"events:job:{id}:progress");

        await subscriber.SubscribeAsync(channel, async (ch, message) =>
        {
            if (ct.IsCancellationRequested) return;
            await Response.WriteAsync($"data: {message}\n\n", ct);
            await Response.Body.FlushAsync(ct);
        });

        // Keep connection alive until cancelled or job completes
        try
        {
            while (!ct.IsCancellationRequested)
            {
                await Task.Delay(1000, ct);

                // Check if job is done
                var current = await _db.Jobs.AsNoTracking()
                    .FirstOrDefaultAsync(j => j.Id == id, ct);
                if (current?.Status is JobStatus.Completed or JobStatus.Failed or JobStatus.Dead)
                {
                    await Response.WriteAsync($"data: {{\"progress\":100,\"status\":\"{current.Status}\"}}\n\n", ct);
                    await Response.Body.FlushAsync(ct);
                    break;
                }
            }
        }
        catch (OperationCanceledException) { }
        finally
        {
            await subscriber.UnsubscribeAsync(channel);
        }
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, [FromQuery] string kind = "preview")
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var job = await _db.Jobs.FirstOrDefaultAsync(j => j.Id == id && j.UserId == userId);
        if (job is null) return NotFound();
        if (job.Status != JobStatus.Completed) return BadRequest(new { message = "Job not completed" });

        var s3Key = kind == "master"
            ? $"{userId}/{job.Id}/master.wav"
            : $"{userId}/{job.Id}/preview.mp3";

        var url = await _storage.GeneratePresignedDownloadUrlAsync(ProcessedBucket, s3Key);
        return Ok(new { downloadUrl = url });
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var job = await _db.Jobs.FirstOrDefaultAsync(j => j.Id == id && j.UserId == userId);
        if (job is null) return NotFound();

        if (job.Status is not (JobStatus.Queued or JobStatus.Created))
            return BadRequest(new { message = "Can only cancel queued jobs" });

        job.Status = JobStatus.Cancelled;

        // Refund credits
        if (job.CreditsCost > 0)
        {
            var user = await _db.Users.FindAsync(userId);
            user!.CreditBalance += job.CreditsCost;
            _db.CreditLedgerEntries.Add(new CreditLedgerEntry
            {
                UserId = userId,
                Delta = job.CreditsCost,
                Reason = CreditReason.Refund,
                RefJobId = job.Id,
                BalanceAfter = user.CreditBalance,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();
        return Ok(MapToResponse(job));
    }

    private static JobResponse MapToResponse(Job j) => new(
        j.Id, j.Status.ToString(), j.Preset.ToString(), j.Quality.ToString(),
        j.Progress, j.ErrorMessage, j.EstimatedDurationSec, j.CreatedAt, j.FinishedAt
    );
}
