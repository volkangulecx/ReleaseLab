namespace ReleaseLab.Contracts.Messages;

public record MasteringJobMessage
{
    public Guid JobId { get; init; }
    public Guid UserId { get; init; }
    public string InputS3Key { get; init; } = default!;
    public string OutputBucket { get; init; } = default!;
    public string Preset { get; init; } = default!;
    public string Quality { get; init; } = default!;
    public int AttemptCount { get; init; }
    public DateTime EnqueuedAt { get; init; }
}
