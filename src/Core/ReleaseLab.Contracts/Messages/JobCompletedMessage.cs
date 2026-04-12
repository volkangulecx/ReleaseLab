namespace ReleaseLab.Contracts.Messages;

public record JobCompletedMessage
{
    public Guid JobId { get; init; }
    public string OutputS3Key { get; init; } = default!;
    public DateTime CompletedAt { get; init; }
}
