namespace ReleaseLab.Application.Jobs.DTOs;

public record CreateJobRequest(Guid FileId, string Preset, string Quality);
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
