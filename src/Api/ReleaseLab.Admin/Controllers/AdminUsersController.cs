using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Domain.Entities;
using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Admin.Controllers;

[ApiController]
[Authorize(Policy = "AdminOnly")]
[Route("api/admin/users")]
public class AdminUsersController : ControllerBase
{
    private readonly IAppDbContext _db;

    public AdminUsersController(IAppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? search = null)
    {
        var query = _db.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(u => u.Email.Contains(search) || (u.DisplayName != null && u.DisplayName.Contains(search)));

        var total = await query.CountAsync();
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id, u.Email, u.DisplayName, Plan = u.Plan.ToString(),
                u.CreditBalance, u.EmailVerified, u.CreatedAt
            })
            .ToListAsync();

        return Ok(new { total, page, pageSize, data = users });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        var jobCount = await _db.Jobs.CountAsync(j => j.UserId == id);
        var totalSpent = await _db.Payments
            .Where(p => p.UserId == id && p.Status == PaymentStatus.Succeeded)
            .SumAsync(p => p.AmountCents);

        return Ok(new
        {
            user.Id, user.Email, user.DisplayName, Plan = user.Plan.ToString(),
            user.CreditBalance, user.EmailVerified, user.CreatedAt, user.UpdatedAt,
            jobCount, totalSpentCents = totalSpent
        });
    }

    [HttpPost("{id:guid}/credits")]
    public async Task<IActionResult> AddCredits(Guid id, [FromBody] AdminAddCreditsRequest request)
    {
        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        user.CreditBalance += request.Amount;

        _db.CreditLedgerEntries.Add(new CreditLedgerEntry
        {
            UserId = id,
            Delta = request.Amount,
            Reason = CreditReason.Bonus,
            BalanceAfter = user.CreditBalance,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { user.CreditBalance });
    }

    [HttpPut("{id:guid}/plan")]
    public async Task<IActionResult> UpdatePlan(Guid id, [FromBody] AdminUpdatePlanRequest request)
    {
        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        if (!Enum.TryParse<UserPlan>(request.Plan, true, out var plan))
            return BadRequest(new { message = "Invalid plan" });

        user.Plan = plan;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { user.Id, Plan = user.Plan.ToString() });
    }
}

public record AdminAddCreditsRequest(int Amount);
public record AdminUpdatePlanRequest(string Plan);
