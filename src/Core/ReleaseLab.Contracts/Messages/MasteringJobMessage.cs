namespace ReleaseLab.Contracts.Messages;

public record MasteringJobMessage
{
    public Guid JobId { get; init; }
    public Guid UserId { get; init; }
    public string InputS3Key { get; init; } = default!;
    public string OutputBucket { get; init; } = default!;
    public string Preset { get; init; } = default!;
    public string Quality { get; init; } = default!;
    public string UserPlan { get; init; } = "Free";
    public string? LoudnessTarget { get; init; }     // spotify | apple | youtube | club | custom
    public double? CustomLufs { get; init; }          // -6 to -20
    public double? LowEq { get; init; }              // -12 to +12 dB override
    public double? MidEq { get; init; }
    public double? HighEq { get; init; }
    public string? ReferenceS3Key { get; init; }      // reference track for AI matching
    public bool DeBreath { get; init; }               // remove breath sounds
    public bool DeNoise { get; init; }                // remove background noise
    public bool DeEss { get; init; }                  // reduce sibilance
    public int AttemptCount { get; init; }
    public DateTime EnqueuedAt { get; init; }
}
