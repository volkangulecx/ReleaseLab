using Microsoft.EntityFrameworkCore;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Infrastructure.Data;

public class AppDbContext : DbContext, IAppDbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<AudioFile> Files => Set<AudioFile>();
    public DbSet<Job> Jobs => Set<Job>();
    public DbSet<CreditLedgerEntry> CreditLedgerEntries => Set<CreditLedgerEntry>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
