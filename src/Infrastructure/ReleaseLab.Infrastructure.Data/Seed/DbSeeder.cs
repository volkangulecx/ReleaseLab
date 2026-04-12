using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ReleaseLab.Domain.Entities;
using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Infrastructure.Data.Seed;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db, ILogger logger)
    {
        if (await db.Users.AnyAsync())
        {
            logger.LogInformation("Database already seeded, skipping");
            return;
        }

        logger.LogInformation("Seeding database...");

        // Admin user
        var adminUser = new User
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
            Email = "admin@releaselab.io",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!", workFactor: 12),
            DisplayName = "Admin",
            Plan = UserPlan.Studio,
            EmailVerified = true,
            CreditBalance = 100,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Demo user
        var demoUser = new User
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
            Email = "demo@releaselab.io",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Demo123!", workFactor: 12),
            DisplayName = "Demo User",
            Plan = UserPlan.Pro,
            EmailVerified = true,
            CreditBalance = 10,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Users.AddRange(adminUser, demoUser);

        // Seed credit entries for demo user
        db.CreditLedgerEntries.Add(new CreditLedgerEntry
        {
            UserId = demoUser.Id,
            Delta = 10,
            Reason = CreditReason.Bonus,
            BalanceAfter = 10,
            CreatedAt = DateTime.UtcNow
        });

        db.CreditLedgerEntries.Add(new CreditLedgerEntry
        {
            UserId = adminUser.Id,
            Delta = 100,
            Reason = CreditReason.Bonus,
            BalanceAfter = 100,
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();
        logger.LogInformation("Database seeded successfully — admin@releaselab.io / Admin123! | demo@releaselab.io / Demo123!");
    }
}
