using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Domain.Entities;

public class Job
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid InputFileId { get; set; }
    public Guid? OutputFileId { get; set; }
    public JobStatus Status { get; set; } = JobStatus.Created;
    public string WorkerType { get; set; } = "mastering_v1";
    public MasteringPreset Preset { get; set; }
    public AudioQuality Quality { get; set; }
    public short Progress { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public short AttemptCount { get; set; }
    public int CreditsCost { get; set; }
    public int? EstimatedDurationSec { get; set; }
    public string? MasteringSettings { get; set; }  // JSON: applied settings summary
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = default!;
    public AudioFile InputFile { get; set; } = default!;
    public AudioFile? OutputFile { get; set; }
}
