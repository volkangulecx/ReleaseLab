namespace ReleaseLab.Domain.Enums;

public enum JobStatus
{
    Created,
    Queued,
    Processing,
    Completed,
    Failed,
    Cancelled,
    Rejected,
    Dead
}
