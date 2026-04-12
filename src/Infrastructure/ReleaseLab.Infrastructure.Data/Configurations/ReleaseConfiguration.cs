using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Infrastructure.Data.Configurations;

public class ReleaseConfiguration : IEntityTypeConfiguration<Release>
{
    public void Configure(EntityTypeBuilder<Release> builder)
    {
        builder.ToTable("releases");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Title).HasMaxLength(500).IsRequired();
        builder.Property(r => r.Artist).HasMaxLength(200).IsRequired();
        builder.Property(r => r.Album).HasMaxLength(500);
        builder.Property(r => r.Genre).HasMaxLength(100);
        builder.Property(r => r.Isrc).HasMaxLength(15);
        builder.Property(r => r.Upc).HasMaxLength(15);
        builder.Property(r => r.Language).HasMaxLength(10);
        builder.Property(r => r.Copyright).HasMaxLength(500);
        builder.Property(r => r.Status).HasMaxLength(20);
        builder.Property(r => r.DistributorId).HasMaxLength(30);
        builder.Property(r => r.ExternalReleaseId).HasMaxLength(200);
        builder.Property(r => r.CreatedAt).HasDefaultValueSql("now()");
        builder.HasIndex(r => r.UserId);
        builder.HasIndex(r => r.Status);

        builder.HasOne(r => r.User).WithMany().HasForeignKey(r => r.UserId);
    }
}
