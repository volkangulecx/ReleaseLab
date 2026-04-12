using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Infrastructure.Data.Configurations;

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("payments");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.StripeSessionId).HasMaxLength(200);
        builder.Property(p => p.StripePaymentIntentId).HasMaxLength(200);
        builder.Property(p => p.Currency).HasMaxLength(3);
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.CreatedAt).HasDefaultValueSql("now()");
        builder.HasIndex(p => p.UserId);
        builder.HasIndex(p => p.StripePaymentIntentId);

        builder.HasOne(p => p.User)
            .WithMany(u => u.Payments)
            .HasForeignKey(p => p.UserId);
    }
}
