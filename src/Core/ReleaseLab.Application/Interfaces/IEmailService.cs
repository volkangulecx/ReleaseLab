namespace ReleaseLab.Application.Interfaces;

public interface IEmailService
{
    Task SendVerificationEmailAsync(string toEmail, string code);
    Task SendPasswordResetEmailAsync(string toEmail, string token);
}
