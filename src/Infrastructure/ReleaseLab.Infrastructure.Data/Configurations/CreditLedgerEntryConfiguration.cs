using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Infrastructure.Data.Configurations;

public class CreditLedgerEntryConfiguration : IEntityTypeConfiguration<CreditLedgerEntry>
{
    public void Configure(EntityTypeBuilder<CreditLedgerEntry> builder)
    {
        builder.ToTable("credits_ledger");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).UseIdentityAlwaysColumn();
        builder.Property(c => c.Reason).HasConversion<string>().HasMaxLength(30);
        builder.Property(c => c.CreatedAt).HasDefaultValueSql("now()");
        builder.HasIndex(c => new { c.UserId, c.CreatedAt })
            .IsDescending(false, true);

        builder.HasOne(c => c.User)
            .WithMany(u => u.CreditEntries)
            .HasForeignKey(c => c.UserId);
    }
}
