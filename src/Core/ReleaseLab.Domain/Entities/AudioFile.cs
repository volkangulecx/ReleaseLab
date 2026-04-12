using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Domain.Entities;

public class AudioFile
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string S3Key { get; set; } = default!;
    public FileKind Kind { get; set; }
    public string Format { get; set; } = default!;
    public int? DurationSec { get; set; }
    public long SizeBytes { get; set; }
    public string? ChecksumSha256 { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = default!;
}
