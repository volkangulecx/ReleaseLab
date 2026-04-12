using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Admin.Controllers;

[ApiController]
[Authorize(Policy = "AdminOnly")]
[Route("api/admin/jobs")]
public class AdminJobsController : ControllerBase
{
    private readonly IAppDbContext _db;

    public AdminJobsController(IAppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? status = null,
        [FromQuery] Guid? userId = null)
    {
        var query = _db.Jobs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<JobStatus>(status, true, out var s))
            query = query.Where(j => j.Status == s);

        if (userId.HasValue)
            query = query.Where(j => j.UserId == userId.Value);

        var total = await query.CountAsync();
        var jobs = await query
            .OrderByDescending(j => j.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(j => new
            {
                j.Id, j.UserId, Status = j.Status.ToString(), Preset = j.Preset.ToString(),
                Quality = j.Quality.ToString(), j.Progress, j.AttemptCount,
                j.ErrorCode, j.ErrorMessage, j.CreditsCost,
                j.CreatedAt, j.StartedAt, j.FinishedAt
            })
            .ToListAsync();

        return Ok(new { total, page, pageSize, data = jobs });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var now = DateTime.UtcNow;
        var last24h = now.AddHours(-24);
        var last7d = now.AddDays(-7);

        var stats = new
        {
            total = await _db.Jobs.CountAsync(),
            queued = await _db.Jobs.CountAsync(j => j.Status == JobStatus.Queued),
            processing = await _db.Jobs.CountAsync(j => j.Status == JobStatus.Processing),
            completed24h = await _db.Jobs.CountAsync(j => j.Status == JobStatus.Completed && j.FinishedAt > last24h),
            failed24h = await _db.Jobs.CountAsync(j => j.Status == JobStatus.Failed && j.FinishedAt > last24h),
            dead = await _db.Jobs.CountAsync(j => j.Status == JobStatus.Dead),
            newUsers7d = await _db.Users.CountAsync(u => u.CreatedAt > last7d),
            totalUsers = await _db.Users.CountAsync()
        };

        return Ok(stats);
    }

    [HttpPost("{id:guid}/retry")]
    public async Task<IActionResult> Retry(Guid id)
    {
        var job = await _db.Jobs.FindAsync(id);
        if (job is null) return NotFound();

        if (job.Status is not (JobStatus.Failed or JobStatus.Dead))
            return BadRequest(new { message = "Can only retry failed/dead jobs" });

        job.Status = JobStatus.Queued;
        job.ErrorCode = null;
        job.ErrorMessage = null;
        job.Progress = 0;
        await _db.SaveChangesAsync();

        return Ok(new { job.Id, Status = job.Status.ToString() });
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var job = await _db.Jobs.FindAsync(id);
        if (job is null) return NotFound();

        if (job.Status is JobStatus.Completed or JobStatus.Cancelled)
            return BadRequest(new { message = "Cannot cancel completed/cancelled jobs" });

        job.Status = JobStatus.Cancelled;
        job.FinishedAt = DateTime.UtcNow;

        // Refund credits
        if (job.CreditsCost > 0)
        {
            var user = await _db.Users.FindAsync(job.UserId);
            if (user is not null)
            {
                user.CreditBalance += job.CreditsCost;
                _db.CreditLedgerEntries.Add(new Domain.Entities.CreditLedgerEntry
                {
                    UserId = job.UserId,
                    Delta = job.CreditsCost,
                    Reason = CreditReason.Refund,
                    RefJobId = job.Id,
                    BalanceAfter = user.CreditBalance,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { job.Id, Status = job.Status.ToString() });
    }
}
