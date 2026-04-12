using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/plans")]
public class PlansController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ISubscriptionService _subscriptions;

    public PlansController(IAppDbContext db, ISubscriptionService subscriptions)
    {
        _db = db;
        _subscriptions = subscriptions;
    }

    [AllowAnonymous]
    [HttpGet]
    public IActionResult ListPlans()
    {
        var plans = new[]
        {
            new
            {
                id = "free", name = "Free", priceCents = 0,
                monthlyMasters = PlanLimits.MonthlyMasters(UserPlan.Free),
                maxFileSizeMb = PlanLimits.MaxFileSizeBytes(UserPlan.Free) / 1024 / 1024,
                priorityQueue = PlanLimits.HasPriorityQueue(UserPlan.Free),
                outputFormats = PlanLimits.MasterOutputFormats(UserPlan.Free)
            },
            new
            {
                id = "pro", name = "Pro", priceCents = PlanLimits.PriceCentsMonthly(UserPlan.Pro),
                monthlyMasters = PlanLimits.MonthlyMasters(UserPlan.Pro),
                maxFileSizeMb = PlanLimits.MaxFileSizeBytes(UserPlan.Pro) / 1024 / 1024,
                priorityQueue = PlanLimits.HasPriorityQueue(UserPlan.Pro),
                outputFormats = PlanLimits.MasterOutputFormats(UserPlan.Pro)
            },
            new
            {
                id = "studio", name = "Studio", priceCents = PlanLimits.PriceCentsMonthly(UserPlan.Studio),
                monthlyMasters = PlanLimits.MonthlyMasters(UserPlan.Studio),
                maxFileSizeMb = PlanLimits.MaxFileSizeBytes(UserPlan.Studio) / 1024 / 1024,
                priorityQueue = PlanLimits.HasPriorityQueue(UserPlan.Studio),
                outputFormats = PlanLimits.MasterOutputFormats(UserPlan.Studio)
            }
        };
        return Ok(plans);
    }

    [HttpGet("current")]
    public async Task<IActionResult> CurrentPlan()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        var sub = await _db.Subscriptions
            .Where(s => s.UserId == userId && (s.Status == "active" || s.Status == "trialing"))
            .FirstOrDefaultAsync();

        var plan = sub?.Plan ?? user.Plan;
        var canCreate = await _subscriptions.CanCreateMasterAsync(userId);

        var periodStart = sub?.CurrentPeriodStart ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var mastersUsed = await _db.Jobs
            .CountAsync(j => j.UserId == userId && j.CreatedAt >= periodStart &&
                            j.Status != Domain.Enums.JobStatus.Cancelled && j.Status != Domain.Enums.JobStatus.Rejected);

        return Ok(new
        {
            plan = plan.ToString(),
            mastersUsed,
            mastersLimit = PlanLimits.MonthlyMasters(plan),
            canCreateMaster = canCreate,
            maxFileSizeMb = PlanLimits.MaxFileSizeBytes(plan) / 1024 / 1024,
            subscription = sub is null ? null : new
            {
                status = sub.Status,
                currentPeriodEnd = sub.CurrentPeriodEnd,
                canceledAt = sub.CanceledAt
            }
        });
    }

    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] SubscribeRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        if (!Enum.TryParse<UserPlan>(request.Plan, true, out var plan) || plan == UserPlan.Free)
            return BadRequest(new { message = "Invalid plan. Choose 'pro' or 'studio'" });

        try
        {
            var url = await _subscriptions.CreateCheckoutSessionAsync(userId, user.Email, plan, request.SuccessUrl, request.CancelUrl);
            return Ok(new { checkoutUrl = url });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("cancel")]
    public async Task<IActionResult> Cancel()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        try
        {
            await _subscriptions.CancelSubscriptionAsync(userId);
            return Ok(new { message = "Subscription will be canceled at end of billing period" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

public record SubscribeRequest(string Plan, string SuccessUrl, string CancelUrl);
