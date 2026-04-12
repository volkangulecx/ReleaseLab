using Microsoft.AspNetCore.SignalR;
using ReleaseLab.Api.Hubs;
using ReleaseLab.Application.Interfaces;

namespace ReleaseLab.Api.Services;

public class SignalRNotificationService : INotificationService
{
    private readonly IHubContext<JobHub> _hub;

    public SignalRNotificationService(IHubContext<JobHub> hub)
    {
        _hub = hub;
    }

    public async Task NotifyJobProgressAsync(Guid userId, Guid jobId, short progress, string? stage)
    {
        await _hub.Clients.Group($"user:{userId}").SendAsync("JobProgress", new
        {
            jobId,
            progress,
            stage
        });
    }

    public async Task NotifyJobCompletedAsync(Guid userId, Guid jobId, string preset)
    {
        await _hub.Clients.Group($"user:{userId}").SendAsync("JobCompleted", new
        {
            jobId,
            preset,
            message = $"Your {preset} master is ready!"
        });
    }

    public async Task NotifyJobFailedAsync(Guid userId, Guid jobId, string? errorMessage)
    {
        await _hub.Clients.Group($"user:{userId}").SendAsync("JobFailed", new
        {
            jobId,
            errorMessage
        });
    }
}
