using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Interfaces;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/export")]
public class ExportController : ControllerBase
{
    private readonly IAppDbContext _db;

    public ExportController(IAppDbContext db)
    {
        _db = db;
    }

    [HttpGet("jobs/csv")]
    public async Task<IActionResult> ExportJobsCsv()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var jobs = await _db.Jobs
            .Where(j => j.UserId == userId)
            .OrderByDescending(j => j.CreatedAt)
            .Select(j => new
            {
                j.Id,
                Status = j.Status.ToString(),
                Preset = j.Preset.ToString(),
                Quality = j.Quality.ToString(),
                j.Progress,
                j.CreditsCost,
                j.EstimatedDurationSec,
                j.ErrorMessage,
                j.CreatedAt,
                j.StartedAt,
                j.FinishedAt
            })
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Id,Status,Preset,Quality,Progress,CreditsCost,EstimatedSec,Error,CreatedAt,StartedAt,FinishedAt");

        foreach (var j in jobs)
        {
            sb.AppendLine(string.Join(",",
                j.Id,
                j.Status,
                j.Preset,
                j.Quality,
                j.Progress,
                j.CreditsCost,
                j.EstimatedDurationSec?.ToString() ?? "",
                $"\"{j.ErrorMessage?.Replace("\"", "\"\"") ?? ""}\"",
                j.CreatedAt.ToString("O"),
                j.StartedAt?.ToString("O") ?? "",
                j.FinishedAt?.ToString("O") ?? ""
            ));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"releaselab-jobs-{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    [HttpGet("credits/csv")]
    public async Task<IActionResult> ExportCreditsCsv()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var entries = await _db.CreditLedgerEntries
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                c.Delta,
                Reason = c.Reason.ToString(),
                c.BalanceAfter,
                c.RefJobId,
                c.RefPaymentId,
                c.CreatedAt
            })
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Delta,Reason,BalanceAfter,RefJobId,RefPaymentId,CreatedAt");

        foreach (var e in entries)
        {
            sb.AppendLine(string.Join(",",
                e.Delta,
                e.Reason,
                e.BalanceAfter,
                e.RefJobId?.ToString() ?? "",
                e.RefPaymentId?.ToString() ?? "",
                e.CreatedAt.ToString("O")
            ));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"releaselab-credits-{DateTime.UtcNow:yyyyMMdd}.csv");
    }
}
