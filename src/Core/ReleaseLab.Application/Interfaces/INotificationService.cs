namespace ReleaseLab.Application.Interfaces;

public interface INotificationService
{
    Task NotifyJobProgressAsync(Guid userId, Guid jobId, short progress, string? stage);
    Task NotifyJobCompletedAsync(Guid userId, Guid jobId, string preset);
    Task NotifyJobFailedAsync(Guid userId, Guid jobId, string? errorMessage);
}
