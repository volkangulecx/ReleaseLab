using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Infrastructure.Data.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("audit_logs");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).UseIdentityAlwaysColumn();
        builder.Property(a => a.Action).HasMaxLength(50).IsRequired();
        builder.Property(a => a.TargetType).HasMaxLength(30);
        builder.Property(a => a.TargetId).HasMaxLength(50);
        builder.Property(a => a.IpAddress).HasMaxLength(45);
        builder.Property(a => a.CreatedAt).HasDefaultValueSql("now()");
        builder.HasIndex(a => a.UserId);
        builder.HasIndex(a => a.CreatedAt);
    }
}
