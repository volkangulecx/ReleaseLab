using System.Diagnostics;
using System.Diagnostics.Metrics;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

namespace ReleaseLab.Api.Extensions;

public static class ObservabilityExtensions
{
    public static readonly ActivitySource ActivitySource = new("ReleaseLab.Api");
    public static readonly Meter Meter = new("ReleaseLab.Api");

    // Counters
    public static readonly Counter<long> JobsCreated = Meter.CreateCounter<long>("releaselab_jobs_created_total", "jobs", "Total jobs created");
    public static readonly Counter<long> JobsCompleted = Meter.CreateCounter<long>("releaselab_jobs_completed_total", "jobs", "Total jobs completed");
    public static readonly Counter<long> JobsFailed = Meter.CreateCounter<long>("releaselab_jobs_failed_total", "jobs", "Total jobs failed");
    public static readonly Counter<long> UploadsTotal = Meter.CreateCounter<long>("releaselab_uploads_total", "uploads", "Total file uploads");
    public static readonly Counter<long> AuthRegistrations = Meter.CreateCounter<long>("releaselab_auth_registrations_total", "registrations", "Total registrations");
    public static readonly Counter<long> AuthLogins = Meter.CreateCounter<long>("releaselab_auth_logins_total", "logins", "Total logins");
    public static readonly Counter<long> CreditsPurchased = Meter.CreateCounter<long>("releaselab_credits_purchased_total", "credits", "Total credits purchased");

    // Histograms
    public static readonly Histogram<double> JobDuration = Meter.CreateHistogram<double>("releaselab_job_duration_seconds", "s", "Job processing duration");

    public static IServiceCollection AddObservability(this IServiceCollection services)
    {
        services.AddOpenTelemetry()
            .WithTracing(tracing => tracing
                .AddSource(ActivitySource.Name)
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation())
            .WithMetrics(metrics => metrics
                .AddMeter(Meter.Name)
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddPrometheusExporter());

        return services;
    }
}
