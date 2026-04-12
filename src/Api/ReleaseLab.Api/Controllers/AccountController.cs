using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/account")]
public class AccountController : ControllerBase
{
    private readonly IAppDbContext _db;

    public AccountController(IAppDbContext db)
    {
        _db = db;
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteAccount()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        // Check for active jobs
        var activeJobs = await _db.Jobs
            .AnyAsync(j => j.UserId == userId && (j.Status == JobStatus.Queued || j.Status == JobStatus.Processing));

        if (activeJobs)
            return BadRequest(new { message = "Cannot delete account while jobs are processing. Cancel them first." });

        // Revoke all tokens
        var tokens = await _db.RefreshTokens.Where(r => r.UserId == userId).ToListAsync();
        _db.RefreshTokens.RemoveRange(tokens);

        // Remove verification codes
        var codes = await _db.VerificationCodes.Where(v => v.UserId == userId).ToListAsync();
        _db.VerificationCodes.RemoveRange(codes);

        // Soft-delete: anonymize PII instead of hard delete
        user.Email = $"deleted_{userId:N}@deleted.releaselab.io";
        user.PasswordHash = "";
        user.DisplayName = null;
        user.EmailVerified = false;
        user.Plan = UserPlan.Free;
        user.CreditBalance = 0;
        user.UpdatedAt = DateTime.UtcNow;

        // Log the deletion
        _db.AuditLogs.Add(new Domain.Entities.AuditLog
        {
            UserId = userId,
            Action = "account.deleted",
            TargetType = "User",
            TargetId = userId.ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { message = "Account deleted successfully" });
    }
}
