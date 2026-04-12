using Microsoft.EntityFrameworkCore;
using ReleaseLab.Infrastructure.Data;

namespace ReleaseLab.Api.Services;

public class CleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<CleanupService> _logger;

    public CleanupService(IServiceScopeFactory scopeFactory, ILogger<CleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Cleanup service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredTokens(stoppingToken);
                await CleanupExpiredVerificationCodes(stoppingToken);
                CleanupTempFiles();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in cleanup service");
            }

            // Run every hour
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task CleanupExpiredTokens(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow.AddDays(-7);
        var expired = await db.RefreshTokens
            .Where(r => r.ExpiresAt < cutoff || (r.RevokedAt != null && r.RevokedAt < cutoff))
            .ToListAsync(ct);

        if (expired.Count > 0)
        {
            db.RefreshTokens.RemoveRange(expired);
            await db.SaveChangesAsync(ct);
            _logger.LogInformation("Cleaned up {Count} expired refresh tokens", expired.Count);
        }
    }

    private async Task CleanupExpiredVerificationCodes(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow.AddDays(-1);
        var expired = await db.VerificationCodes
            .Where(v => v.ExpiresAt < cutoff || v.Used)
            .ToListAsync(ct);

        if (expired.Count > 0)
        {
            db.VerificationCodes.RemoveRange(expired);
            await db.SaveChangesAsync(ct);
            _logger.LogInformation("Cleaned up {Count} expired verification codes", expired.Count);
        }
    }

    private void CleanupTempFiles()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), "releaselab");
        if (!Directory.Exists(tempDir)) return;

        var cutoff = DateTime.UtcNow.AddHours(-24);
        var cleaned = 0;

        foreach (var dir in Directory.GetDirectories(tempDir))
        {
            var info = new DirectoryInfo(dir);
            if (info.CreationTimeUtc < cutoff)
            {
                try
                {
                    info.Delete(true);
                    cleaned++;
                }
                catch { }
            }
        }

        if (cleaned > 0)
            _logger.LogInformation("Cleaned up {Count} temp directories", cleaned);
    }
}
