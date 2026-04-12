namespace ReleaseLab.Contracts.Messages;

public record JobProgressMessage
{
    public Guid JobId { get; init; }
    public short Progress { get; init; }
    public string? Stage { get; init; }
}
