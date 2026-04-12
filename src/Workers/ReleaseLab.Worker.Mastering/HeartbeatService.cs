using StackExchange.Redis;

namespace ReleaseLab.Worker.Mastering;

public class HeartbeatService : BackgroundService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<HeartbeatService> _logger;
    private readonly string _workerId = $"worker:{Environment.MachineName}:{Guid.NewGuid():N[..8]}";

    public HeartbeatService(IConnectionMultiplexer redis, ILogger<HeartbeatService> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var db = _redis.GetDatabase();
        _logger.LogInformation("Heartbeat service started for worker {WorkerId}", _workerId);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await db.StringSetAsync($"worker:heartbeat:{_workerId}", DateTime.UtcNow.ToString("O"), TimeSpan.FromSeconds(30));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send heartbeat");
            }

            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        }
    }
}
