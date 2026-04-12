namespace ReleaseLab.Contracts.Messages;

public record JobFailedMessage
{
    public Guid JobId { get; init; }
    public string ErrorCode { get; init; } = default!;
    public string ErrorMessage { get; init; } = default!;
    public bool Retryable { get; init; }
    public DateTime FailedAt { get; init; }
}
