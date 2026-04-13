using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Api.Extensions;
using ReleaseLab.Application.Credits.DTOs;
using ReleaseLab.Application.Interfaces;
using StackExchange.Redis;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/credits")]
public class CreditsController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly IPaymentService _paymentService;
    private readonly IConnectionMultiplexer _redis;

    public CreditsController(IAppDbContext db, IPaymentService paymentService, IConnectionMultiplexer redis)
    {
        _db = db;
        _paymentService = paymentService;
        _redis = redis;
    }

    [HttpGet("balance")]
    public async Task<IActionResult> Balance()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var response = await _redis.GetOrSetAsync(
            $"cache:credits:{userId}",
            async () =>
            {
                var user = await _db.Users.FindAsync(userId);
                if (user is null) return null;

                var recentHistory = await _db.CreditLedgerEntries
                    .Where(c => c.UserId == userId)
                    .OrderByDescending(c => c.CreatedAt)
                    .Take(20)
                    .Select(c => new CreditHistoryItem(c.Delta, c.Reason.ToString(), c.BalanceAfter, c.CreatedAt))
                    .ToListAsync();

                return new CreditBalanceResponse(user.CreditBalance, recentHistory);
            },
            TimeSpan.FromSeconds(30));

        if (response is null) return NotFound();
        return Ok(response);
        // TODO: Invalidate cache key $"cache:credits:{userId}" on credit purchase, refund, or any balance change
    }

    [HttpPost("purchase")]
    public async Task<IActionResult> Purchase([FromBody] PurchaseCreditsRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        try
        {
            var checkoutUrl = await _paymentService.CreateCheckoutSessionAsync(
                userId, user.Email, request.CreditAmount, request.SuccessUrl, request.CancelUrl);
            return Ok(new { checkoutUrl });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
