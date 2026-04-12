using Polly;
using Polly.Extensions.Http;
using Polly.Retry;

namespace ReleaseLab.Api.Extensions;

public static class ResilienceExtensions
{
    public static AsyncRetryPolicy CreateRetryPolicy(ILogger logger, string operationName, int retryCount = 3)
    {
        return Policy
            .Handle<Exception>(ex => ex is not ArgumentException and not UnauthorizedAccessException)
            .WaitAndRetryAsync(
                retryCount,
                attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)),
                (exception, timespan, attempt, _) =>
                {
                    logger.LogWarning(exception,
                        "Retry {Attempt}/{MaxRetries} for {Operation} after {Delay}s",
                        attempt, retryCount, operationName, timespan.TotalSeconds);
                });
    }
}
