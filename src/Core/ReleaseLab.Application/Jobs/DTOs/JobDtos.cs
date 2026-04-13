namespace ReleaseLab.Application.Jobs.DTOs;

public record CreateJobRequest(
    Guid FileId,
    string Preset,
    string Quality,
    string? LoudnessTarget = null,     // spotify | apple | youtube | club | custom
    double? CustomLufs = null,          // -6 to -20
    double? LowEq = null,              // -12 to +12
    double? MidEq = null,
    double? HighEq = null,
    Guid? ReferenceFileId = null,       // optional reference track
    bool DeBreath = false,              // remove breath sounds
    bool DeNoise = false,               // remove background noise
    bool DeEss = false                  // reduce sibilance
);

public record JobResponse(
    Guid Id,
    string Status,
    string Preset,
    string Quality,
    short Progress,
    string? ErrorMessage,
    int? EstimatedDurationSec,
    DateTime CreatedAt,
    DateTime? FinishedAt
);
