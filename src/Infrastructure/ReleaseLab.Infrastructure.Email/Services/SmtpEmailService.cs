using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ReleaseLab.Application.Interfaces;

namespace ReleaseLab.Infrastructure.Email.Services;

public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IConfiguration config, ILogger<SmtpEmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendVerificationEmailAsync(string toEmail, string code)
    {
        var subject = "Verify your ReleaseLab account";
        var body = $@"
<html>
<body style=""font-family: Arial, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 40px;"">
  <div style=""max-width: 480px; margin: 0 auto; background: #18181b; border-radius: 12px; padding: 32px; border: 1px solid #27272a;"">
    <h2 style=""color: #8b5cf6; margin-top: 0;"">ReleaseLab</h2>
    <p>Your verification code is:</p>
    <div style=""background: #27272a; border-radius: 8px; padding: 16px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #8b5cf6; margin: 20px 0;"">
      {code}
    </div>
    <p style=""color: #a1a1aa; font-size: 14px;"">This code expires in 15 minutes. If you didn't create an account, ignore this email.</p>
  </div>
</body>
</html>";

        await SendEmailAsync(toEmail, subject, body);
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string token)
    {
        var resetUrl = _config["App:FrontendUrl"] ?? "http://localhost:3000";
        var subject = "Reset your ReleaseLab password";
        var body = $@"
<html>
<body style=""font-family: Arial, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 40px;"">
  <div style=""max-width: 480px; margin: 0 auto; background: #18181b; border-radius: 12px; padding: 32px; border: 1px solid #27272a;"">
    <h2 style=""color: #8b5cf6; margin-top: 0;"">ReleaseLab</h2>
    <p>You requested a password reset. Click the button below:</p>
    <div style=""text-align: center; margin: 24px 0;"">
      <a href=""{resetUrl}/auth/reset-password?email={Uri.EscapeDataString(toEmail)}&token={Uri.EscapeDataString(token)}""
         style=""background: #8b5cf6; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;"">
        Reset Password
      </a>
    </div>
    <p style=""color: #a1a1aa; font-size: 14px;"">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
  </div>
</body>
</html>";

        await SendEmailAsync(toEmail, subject, body);
    }

    private async Task SendEmailAsync(string to, string subject, string htmlBody)
    {
        try
        {
            var host = _config["Smtp:Host"] ?? "smtp.gmail.com";
            var port = int.Parse(_config["Smtp:Port"] ?? "587");
            var user = _config["Smtp:User"] ?? "";
            var pass = _config["Smtp:Password"] ?? "";
            var from = _config["Smtp:From"] ?? "noreply@releaselab.io";

            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(user, pass),
                EnableSsl = true
            };

            var message = new MailMessage(from, to, subject, htmlBody)
            {
                IsBodyHtml = true
            };

            await client.SendMailAsync(message);
            _logger.LogInformation("Email sent to {Email}: {Subject}", to, subject);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {Email}", to);
            throw;
        }
    }
}
