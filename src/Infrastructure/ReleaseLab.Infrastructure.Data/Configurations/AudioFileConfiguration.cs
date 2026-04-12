using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Infrastructure.Data.Configurations;

public class AudioFileConfiguration : IEntityTypeConfiguration<AudioFile>
{
    public void Configure(EntityTypeBuilder<AudioFile> builder)
    {
        builder.ToTable("files");
        builder.HasKey(f => f.Id);
        builder.Property(f => f.S3Key).IsRequired();
        builder.Property(f => f.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(f => f.Format).HasMaxLength(10);
        builder.Property(f => f.ChecksumSha256).HasMaxLength(64);
        builder.Property(f => f.CreatedAt).HasDefaultValueSql("now()");
        builder.HasIndex(f => new { f.UserId, f.Kind });

        builder.HasOne(f => f.User)
            .WithMany(u => u.Files)
            .HasForeignKey(f => f.UserId);
    }
}
