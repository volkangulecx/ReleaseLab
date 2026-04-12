namespace ReleaseLab.Contracts.Messages;

public record MixdownMessage
{
    public Guid ProjectId { get; init; }
    public Guid UserId { get; init; }
    public string OutputBucket { get; init; } = default!;
    public MixdownTrackInfo[] Tracks { get; init; } = [];
    public DateTime EnqueuedAt { get; init; }
}

public record MixdownTrackInfo
{
    public string S3Key { get; init; } = default!;
    public double Volume { get; init; } = 1.0;
    public double Pan { get; init; } = 0.0;
    public bool Muted { get; init; }
}
