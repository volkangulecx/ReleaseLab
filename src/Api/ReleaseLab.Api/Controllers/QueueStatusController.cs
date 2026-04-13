using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StackExchange.Redis;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/queue")]
public class QueueStatusController : ControllerBase
{
    private readonly IConnectionMultiplexer _redis;

    public QueueStatusController(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var db = _redis.GetDatabase();

        var high = await db.ListLengthAsync("queue:mastering:priority-high");
        var normal = await db.ListLengthAsync("queue:mastering:priority-normal");
        var low = await db.ListLengthAsync("queue:mastering:priority-low");
        var processing = await db.ListLengthAsync("queue:mastering:processing");

        return Ok(new
        {
            queued = high + normal + low,
            processing,
            priorityHigh = high,
            priorityNormal = normal,
            priorityLow = low,
        });
    }
}
