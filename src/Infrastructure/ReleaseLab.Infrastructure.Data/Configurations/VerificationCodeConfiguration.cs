using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Infrastructure.Data.Configurations;

public class VerificationCodeConfiguration : IEntityTypeConfiguration<VerificationCode>
{
    public void Configure(EntityTypeBuilder<VerificationCode> builder)
    {
        builder.ToTable("verification_codes");
        builder.HasKey(v => v.Id);
        builder.Property(v => v.Code).HasMaxLength(10).IsRequired();
        builder.Property(v => v.Purpose).HasMaxLength(20).IsRequired();
        builder.Property(v => v.CreatedAt).HasDefaultValueSql("now()");
        builder.HasIndex(v => new { v.UserId, v.Purpose, v.Code });

        builder.HasOne(v => v.User)
            .WithMany()
            .HasForeignKey(v => v.UserId);
    }
}
