using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Infrastructure.Data.Configurations;

public class MixProjectConfiguration : IEntityTypeConfiguration<MixProject>
{
    public void Configure(EntityTypeBuilder<MixProject> builder)
    {
        builder.ToTable("mix_projects");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Name).HasMaxLength(200).IsRequired();
        builder.Property(m => m.Status).HasMaxLength(20);
        builder.Property(m => m.CreatedAt).HasDefaultValueSql("now()");
        builder.HasIndex(m => m.UserId);

        builder.HasOne(m => m.User).WithMany().HasForeignKey(m => m.UserId);
    }
}

public class MixTrackConfiguration : IEntityTypeConfiguration<MixTrack>
{
    public void Configure(EntityTypeBuilder<MixTrack> builder)
    {
        builder.ToTable("mix_tracks");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Name).HasMaxLength(200).IsRequired();
        builder.Property(t => t.Volume).HasDefaultValue(1.0);
        builder.Property(t => t.Pan).HasDefaultValue(0.0);
        builder.Property(t => t.CreatedAt).HasDefaultValueSql("now()");

        builder.HasOne(t => t.Project).WithMany(p => p.Tracks).HasForeignKey(t => t.MixProjectId);
        builder.HasOne(t => t.File).WithMany().HasForeignKey(t => t.FileId);
    }
}
