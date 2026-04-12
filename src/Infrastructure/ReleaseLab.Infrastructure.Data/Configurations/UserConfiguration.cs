using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ReleaseLab.Domain.Entities;
using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Infrastructure.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Email).HasMaxLength(255).IsRequired();
        builder.HasIndex(u => u.Email).IsUnique();
        builder.Property(u => u.PasswordHash).IsRequired();
        builder.Property(u => u.DisplayName).HasMaxLength(100);
        builder.Property(u => u.Plan)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(UserPlan.Free);
        builder.Property(u => u.EmailVerified).HasDefaultValue(false);
        builder.Property(u => u.CreditBalance).HasDefaultValue(0);
        builder.Property(u => u.CreatedAt).HasDefaultValueSql("now()");
        builder.Property(u => u.UpdatedAt).HasDefaultValueSql("now()");
    }
}
