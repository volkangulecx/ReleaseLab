namespace ReleaseLab.Application.Auth.DTOs;

public record RegisterRequest(string Email, string Password, string? DisplayName);
public record LoginRequest(string Email, string Password);
public record RefreshRequest(string RefreshToken);
public record AuthResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt);
public record UpdateProfileRequest(string? DisplayName);
public record UserProfileResponse(
    Guid Id,
    string Email,
    string? DisplayName,
    string Plan,
    int CreditBalance,
    bool EmailVerified,
    bool IsAdmin,
    DateTime CreatedAt
);
