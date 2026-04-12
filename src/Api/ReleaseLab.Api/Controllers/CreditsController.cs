using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ReleaseLab.Application.Interfaces;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/credits")]
public class CreditsController : ControllerBase
{
    private readonly IAppDbContext _db;

    public CreditsController(IAppDbContext db)
    {
        _db = db;
    }

    [HttpGet("balance")]
    public async Task<IActionResult> Balance()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        return Ok(new { balance = user.CreditBalance });
    }
}
