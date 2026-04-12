namespace ReleaseLab.Application.Auth.DTOs;

public record SendVerificationRequest(string Email);
public record VerifyEmailRequest(string Email, string Code);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Token, string NewPassword);
