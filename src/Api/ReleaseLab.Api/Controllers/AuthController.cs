using System.Security.Cryptography;
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
    private readonly IEmailService _email;

    public AuthController(IAppDbContext db, IJwtService jwt, IEmailService email)
    {
        _db = db;
        _jwt = jwt;
        _email = email;
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

        var email = request.Email.ToLowerInvariant().Trim();
        if (await _db.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { message = "Email already registered" });

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 12),
            DisplayName = request.DisplayName,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // Send verification email
        await SendVerificationCodeAsync(user);

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

    // ── Email Verification ──

    [HttpPost("send-verification")]
    public async Task<IActionResult> SendVerification([FromBody] SendVerificationRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email.ToLowerInvariant().Trim());
        if (user is null)
            return Ok(new { message = "If the email exists, a verification code was sent" });

        if (user.EmailVerified)
            return BadRequest(new { message = "Email already verified" });

        await SendVerificationCodeAsync(user);
        return Ok(new { message = "Verification code sent" });
    }

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email.ToLowerInvariant().Trim());
        if (user is null)
            return BadRequest(new { message = "Invalid verification code" });

        var code = await _db.VerificationCodes
            .Where(v => v.UserId == user.Id && v.Purpose == "email_verify" && v.Code == request.Code && !v.Used)
            .OrderByDescending(v => v.CreatedAt)
            .FirstOrDefaultAsync();

        if (code is null || !code.IsValid)
            return BadRequest(new { message = "Invalid or expired verification code" });

        code.Used = true;
        user.EmailVerified = true;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Email verified successfully" });
    }

    // ── Password Reset ──

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email.ToLowerInvariant().Trim());
        if (user is not null)
        {
            var token = GenerateSecureCode(32);
            _db.VerificationCodes.Add(new VerificationCode
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Code = token,
                Purpose = "password_reset",
                ExpiresAt = DateTime.UtcNow.AddHours(1),
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
            await _email.SendPasswordResetEmailAsync(user.Email, token);
        }

        // Always return success to prevent email enumeration
        return Ok(new { message = "If the email exists, a password reset link was sent" });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email.ToLowerInvariant().Trim());
        if (user is null)
            return BadRequest(new { message = "Invalid reset token" });

        var code = await _db.VerificationCodes
            .Where(v => v.UserId == user.Id && v.Purpose == "password_reset" && v.Code == request.Token && !v.Used)
            .OrderByDescending(v => v.CreatedAt)
            .FirstOrDefaultAsync();

        if (code is null || !code.IsValid)
            return BadRequest(new { message = "Invalid or expired reset token" });

        code.Used = true;
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, workFactor: 12);
        user.UpdatedAt = DateTime.UtcNow;

        // Revoke all refresh tokens
        var tokens = await _db.RefreshTokens
            .Where(r => r.UserId == user.Id && r.RevokedAt == null)
            .ToListAsync();
        foreach (var t in tokens) t.RevokedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Password reset successfully" });
    }

    // ── Helpers ──

    private async Task SendVerificationCodeAsync(User user)
    {
        var code = GenerateSecureCode(6);
        _db.VerificationCodes.Add(new VerificationCode
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Code = code,
            Purpose = "email_verify",
            ExpiresAt = DateTime.UtcNow.AddMinutes(15),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
        await _email.SendVerificationEmailAsync(user.Email, code);
    }

    private static string GenerateSecureCode(int length)
    {
        const string chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        var bytes = new byte[length];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return new string(bytes.Select(b => chars[b % chars.Length]).ToArray());
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
