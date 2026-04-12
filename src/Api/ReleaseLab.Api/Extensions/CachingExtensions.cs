using System.Text.Json;
using StackExchange.Redis;

namespace ReleaseLab.Api.Extensions;

public static class CachingExtensions
{
    public static async Task<T?> GetOrSetAsync<T>(
        this IConnectionMultiplexer redis,
        string key,
        Func<Task<T>> factory,
        TimeSpan? expiry = null) where T : class
    {
        var db = redis.GetDatabase();
        var cached = await db.StringGetAsync(key);

        if (cached.HasValue)
            return JsonSerializer.Deserialize<T>(cached!);

        var value = await factory();
        if (value is not null)
        {
            var json = JsonSerializer.Serialize(value);
            await db.StringSetAsync(key, json, expiry ?? TimeSpan.FromMinutes(5));
        }

        return value;
    }

    public static async Task InvalidateAsync(this IConnectionMultiplexer redis, string pattern)
    {
        var endpoints = redis.GetEndPoints();
        var server = redis.GetServer(endpoints[0]);
        var db = redis.GetDatabase();

        await foreach (var key in server.KeysAsync(pattern: pattern))
        {
            await db.KeyDeleteAsync(key);
        }
    }
}
