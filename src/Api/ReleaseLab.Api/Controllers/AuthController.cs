using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Auth.DTOs;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly IJwtService _jwt;

    public AuthController(IAppDbContext db, IJwtService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            return BadRequest(new { message = "Invalid email address" });

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters" });

        if (request.Password.Length > 128)
            return BadRequest(new { message = "Password too long" });

        if (await _db.Users.AnyAsync(u => u.Email == request.Email.ToLowerInvariant().Trim()))
            return Conflict(new { message = "Email already registered" });

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email.ToLowerInvariant().Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 12),
            DisplayName = request.DisplayName,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var (accessToken, refreshToken, expiresAt) = await GenerateTokens(user);

        return Created("", new AuthResponse(accessToken, refreshToken, expiresAt));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email.ToLowerInvariant().Trim());
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password" });

        var (accessToken, refreshToken, expiresAt) = await GenerateTokens(user);

        return Ok(new AuthResponse(accessToken, refreshToken, expiresAt));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request)
    {
        var tokenHash = _jwt.HashToken(request.RefreshToken);
        var stored = await _db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.TokenHash == tokenHash);

        if (stored is null || !stored.IsActive)
            return Unauthorized(new { message = "Invalid or expired refresh token" });

        // Revoke old token
        stored.RevokedAt = DateTime.UtcNow;

        var (accessToken, refreshToken, expiresAt) = await GenerateTokens(stored.User);

        return Ok(new AuthResponse(accessToken, refreshToken, expiresAt));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var userId = Guid.Parse(User.FindFirst("sub")?.Value ?? throw new UnauthorizedAccessException());
        var tokens = await _db.RefreshTokens
            .Where(r => r.UserId == userId && r.RevokedAt == null)
            .ToListAsync();

        foreach (var token in tokens)
            token.RevokedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize]
    [HttpGet("/api/v1/me")]
    public async Task<IActionResult> Me()
    {
        var userId = Guid.Parse(User.FindFirst("sub")?.Value ?? throw new UnauthorizedAccessException());
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        return Ok(new UserProfileResponse(
            user.Id, user.Email, user.DisplayName,
            user.Plan.ToString(), user.CreditBalance, user.CreatedAt
        ));
    }

    private async Task<(string accessToken, string refreshToken, DateTime expiresAt)> GenerateTokens(User user)
    {
        var accessToken = _jwt.GenerateAccessToken(user);
        var refreshTokenStr = _jwt.GenerateRefreshToken();
        var expiresAt = DateTime.UtcNow.AddDays(30);

        _db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = _jwt.HashToken(refreshTokenStr),
            ExpiresAt = expiresAt
        });

        await _db.SaveChangesAsync();

        return (accessToken, refreshTokenStr, expiresAt);
    }
}
