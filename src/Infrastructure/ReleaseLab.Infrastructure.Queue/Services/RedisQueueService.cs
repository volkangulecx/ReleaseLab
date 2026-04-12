using System.Text.Json;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Contracts.Messages;
using ReleaseLab.Domain.Enums;
using StackExchange.Redis;

namespace ReleaseLab.Infrastructure.Queue.Services;

public class RedisQueueService : IQueueService
{
    private readonly IConnectionMultiplexer _redis;
    private const string EventsPrefix = "events:job";

    public RedisQueueService(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public async Task EnqueueMasteringJobAsync(MasteringJobMessage message, UserPlan userPlan = UserPlan.Free)
    {
        var db = _redis.GetDatabase();
        var json = JsonSerializer.Serialize(message);
        var queueName = PlanLimits.QueueName(userPlan);
        await db.ListLeftPushAsync(queueName, json);
    }

    public async Task PublishProgressAsync(JobProgressMessage message)
    {
        var sub = _redis.GetSubscriber();
        var json = JsonSerializer.Serialize(message);
        await sub.PublishAsync(RedisChannel.Literal($"{EventsPrefix}:{message.JobId}:progress"), json);
    }

    public async Task PublishCompletedAsync(JobCompletedMessage message)
    {
        var sub = _redis.GetSubscriber();
        var json = JsonSerializer.Serialize(message);
        await sub.PublishAsync(RedisChannel.Literal($"{EventsPrefix}:completed"), json);
    }

    public async Task PublishFailedAsync(JobFailedMessage message)
    {
        var sub = _redis.GetSubscriber();
        var json = JsonSerializer.Serialize(message);
        await sub.PublishAsync(RedisChannel.Literal($"{EventsPrefix}:failed"), json);
    }
}
