using Microsoft.Extensions.Logging;
using ReleaseLab.Application.Interfaces;

namespace ReleaseLab.Infrastructure.Email.Services;

public class ConsoleEmailService : IEmailService
{
    private readonly ILogger<ConsoleEmailService> _logger;

    public ConsoleEmailService(ILogger<ConsoleEmailService> logger)
    {
        _logger = logger;
    }

    public Task SendVerificationEmailAsync(string toEmail, string code)
    {
        _logger.LogInformation(
            "EMAIL >> To: {Email} | Subject: Verify your ReleaseLab account | Code: {Code}",
            toEmail, code);
        return Task.CompletedTask;
    }

    public Task SendPasswordResetEmailAsync(string toEmail, string token)
    {
        _logger.LogInformation(
            "EMAIL >> To: {Email} | Subject: Reset your password | Token: {Token}",
            toEmail, token);
        return Task.CompletedTask;
    }
}
