using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ReleaseLab.Contracts.Messages;
using ReleaseLab.Domain.Enums;
using ReleaseLab.Infrastructure.Data;
using StackExchange.Redis;

namespace ReleaseLab.Worker.Mastering;

public class DeadLetterProcessor : BackgroundService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DeadLetterProcessor> _logger;

    private const string RetryQueue = "queue:mastering:retry";
    private const string DeadQueue = "queue:mastering:dead";

    public DeadLetterProcessor(
        IConnectionMultiplexer redis,
        IServiceScopeFactory scopeFactory,
        ILogger<DeadLetterProcessor> logger)
    {
        _redis = redis;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Dead letter processor started");
        var db = _redis.GetDatabase();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Check retry queue — move items whose retry time has passed
                var entries = await db.SortedSetRangeByScoreAsync(RetryQueue, 0, DateTimeOffset.UtcNow.ToUnixTimeSeconds(), take: 10);

                foreach (var entry in entries)
                {
                    var message = JsonSerializer.Deserialize<MasteringJobMessage>(entry!);
                    if (message is null) continue;

                    if (message.AttemptCount >= 3)
                    {
                        // Move to dead letter queue
                        await db.ListLeftPushAsync(DeadQueue, entry);
                        _logger.LogWarning("Job {JobId} moved to dead letter queue after {Attempts} attempts", message.JobId, message.AttemptCount);

                        // Update job status in DB
                        using var scope = _scopeFactory.CreateScope();
                        var dbCtx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                        var job = await dbCtx.Jobs.FindAsync(new object[] { message.JobId }, stoppingToken);
                        if (job is not null && job.Status != JobStatus.Dead)
                        {
                            job.Status = JobStatus.Dead;
                            job.FinishedAt = DateTime.UtcNow;
                            await dbCtx.SaveChangesAsync(stoppingToken);
                        }
                    }
                    else
                    {
                        // Re-enqueue for processing
                        await db.ListLeftPushAsync("queue:mastering:priority-normal", entry);
                        _logger.LogInformation("Retrying job {JobId}, attempt {Attempt}", message.JobId, message.AttemptCount + 1);
                    }

                    await db.SortedSetRemoveAsync(RetryQueue, entry);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in dead letter processor");
            }

            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
}
