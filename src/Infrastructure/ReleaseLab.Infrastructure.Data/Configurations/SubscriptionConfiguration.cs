using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Infrastructure.Data.Configurations;

public class SubscriptionConfiguration : IEntityTypeConfiguration<Subscription>
{
    public void Configure(EntityTypeBuilder<Subscription> builder)
    {
        builder.ToTable("subscriptions");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Plan).HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.StripeSubscriptionId).HasMaxLength(200);
        builder.Property(s => s.StripeCustomerId).HasMaxLength(200);
        builder.Property(s => s.Status).HasMaxLength(20);
        builder.Property(s => s.CreatedAt).HasDefaultValueSql("now()");
        builder.HasIndex(s => s.UserId);
        builder.HasIndex(s => s.StripeSubscriptionId).IsUnique();

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId);
    }
}
