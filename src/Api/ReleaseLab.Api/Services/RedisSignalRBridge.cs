using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Api.Hubs;
using ReleaseLab.Infrastructure.Data;
using StackExchange.Redis;

namespace ReleaseLab.Api.Services;

public class RedisSignalRBridge : BackgroundService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IHubContext<JobHub> _hub;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RedisSignalRBridge> _logger;

    public RedisSignalRBridge(
        IConnectionMultiplexer redis,
        IHubContext<JobHub> hub,
        IServiceScopeFactory scopeFactory,
        ILogger<RedisSignalRBridge> logger)
    {
        _redis = redis;
        _hub = hub;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Redis-SignalR bridge started");
        var subscriber = _redis.GetSubscriber();

        // Subscribe to all job progress events
        await subscriber.SubscribeAsync(RedisChannel.Pattern("events:job:*:progress"), async (channel, message) =>
        {
            try
            {
                var progress = JsonSerializer.Deserialize<ProgressEvent>(message!);
                if (progress is null) return;

                // Look up userId from job
                var userId = await GetJobUserIdAsync(progress.JobId);
                if (userId is null) return;

                await _hub.Clients.Group($"user:{userId}").SendAsync("JobProgress", new
                {
                    jobId = progress.JobId,
                    progress = progress.Progress,
                    stage = progress.Stage
                }, stoppingToken);

                // If completed or failed, send specific notification
                if (progress.Progress >= 100 || progress.Stage == "completed")
                {
                    await _hub.Clients.Group($"user:{userId}").SendAsync("JobCompleted", new
                    {
                        jobId = progress.JobId,
                        message = "Your master is ready!"
                    }, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error relaying progress to SignalR");
            }
        });

        // Subscribe to job completed events
        await subscriber.SubscribeAsync(RedisChannel.Literal("events:job:completed"), async (channel, message) =>
        {
            try
            {
                var evt = JsonSerializer.Deserialize<CompletedEvent>(message!);
                if (evt is null) return;

                var userId = await GetJobUserIdAsync(evt.JobId);
                if (userId is null) return;

                await _hub.Clients.Group($"user:{userId}").SendAsync("JobCompleted", new
                {
                    jobId = evt.JobId,
                    outputS3Key = evt.OutputS3Key,
                    message = "Your master is ready!"
                }, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error relaying completed event to SignalR");
            }
        });

        // Subscribe to job failed events
        await subscriber.SubscribeAsync(RedisChannel.Literal("events:job:failed"), async (channel, message) =>
        {
            try
            {
                var evt = JsonSerializer.Deserialize<FailedEvent>(message!);
                if (evt is null) return;

                var userId = await GetJobUserIdAsync(evt.JobId);
                if (userId is null) return;

                await _hub.Clients.Group($"user:{userId}").SendAsync("JobFailed", new
                {
                    jobId = evt.JobId,
                    errorMessage = evt.ErrorMessage
                }, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error relaying failed event to SignalR");
            }
        });

        // Keep alive until cancelled
        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException) { }
    }

    private async Task<string?> GetJobUserIdAsync(Guid jobId)
    {
        // Cache in Redis for performance
        var db = _redis.GetDatabase();
        var cacheKey = $"job:owner:{jobId}";
        var cached = await db.StringGetAsync(cacheKey);
        if (cached.HasValue) return cached.ToString();

        // Lookup from DB
        using var scope = _scopeFactory.CreateScope();
        var dbCtx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var job = await dbCtx.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == jobId);
        if (job is null) return null;

        var userId = job.UserId.ToString();
        await db.StringSetAsync(cacheKey, userId, TimeSpan.FromHours(1));
        return userId;
    }

    private record ProgressEvent(Guid JobId, short Progress, string? Stage);
    private record CompletedEvent(Guid JobId, string OutputS3Key);
    private record FailedEvent(Guid JobId, string ErrorCode, string ErrorMessage);
}
