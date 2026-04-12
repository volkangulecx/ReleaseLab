using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Credits.DTOs;
using ReleaseLab.Application.Interfaces;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/credits")]
public class CreditsController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly IPaymentService _paymentService;

    public CreditsController(IAppDbContext db, IPaymentService paymentService)
    {
        _db = db;
        _paymentService = paymentService;
    }

    [HttpGet("balance")]
    public async Task<IActionResult> Balance()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        var recentHistory = await _db.CreditLedgerEntries
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.CreatedAt)
            .Take(20)
            .Select(c => new CreditHistoryItem(c.Delta, c.Reason.ToString(), c.BalanceAfter, c.CreatedAt))
            .ToListAsync();

        return Ok(new CreditBalanceResponse(user.CreditBalance, recentHistory));
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
