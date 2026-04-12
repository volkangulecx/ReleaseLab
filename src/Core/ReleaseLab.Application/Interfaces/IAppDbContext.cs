using Microsoft.EntityFrameworkCore;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Application.Interfaces;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<AudioFile> Files { get; }
    DbSet<Job> Jobs { get; }
    DbSet<CreditLedgerEntry> CreditLedgerEntries { get; }
    DbSet<Payment> Payments { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<VerificationCode> VerificationCodes { get; }
    DbSet<Subscription> Subscriptions { get; }
    DbSet<AuditLog> AuditLogs { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
