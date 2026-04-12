using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Infrastructure.Data.Configurations;

public class JobConfiguration : IEntityTypeConfiguration<Job>
{
    public void Configure(EntityTypeBuilder<Job> builder)
    {
        builder.ToTable("jobs");
        builder.HasKey(j => j.Id);
        builder.Property(j => j.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(j => j.WorkerType).HasMaxLength(20);
        builder.Property(j => j.Preset).HasConversion<string>().HasMaxLength(30);
        builder.Property(j => j.Quality).HasConversion<string>().HasMaxLength(10);
        builder.Property(j => j.Progress).HasDefaultValue((short)0);
        builder.Property(j => j.ErrorCode).HasMaxLength(50);
        builder.Property(j => j.AttemptCount).HasDefaultValue((short)0);
        builder.Property(j => j.CreatedAt).HasDefaultValueSql("now()");

        builder.HasIndex(j => new { j.UserId, j.CreatedAt })
            .IsDescending(false, true);
        builder.HasIndex(j => j.Status)
            .HasFilter("status IN ('Queued','Processing')");

        builder.HasOne(j => j.User)
            .WithMany(u => u.Jobs)
            .HasForeignKey(j => j.UserId);
        builder.HasOne(j => j.InputFile)
            .WithMany()
            .HasForeignKey(j => j.InputFileId);
        builder.HasOne(j => j.OutputFile)
            .WithMany()
            .HasForeignKey(j => j.OutputFileId);
    }
}
