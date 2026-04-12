using System.Diagnostics.Metrics;

namespace ReleaseLab.Worker.Mastering;

public static class WorkerMetrics
{
    public static readonly Meter Meter = new("ReleaseLab.Worker");

    public static readonly Counter<long> JobsProcessed = Meter.CreateCounter<long>(
        "releaselab_worker_jobs_processed_total", "jobs", "Total jobs processed by worker");

    public static readonly Counter<long> JobsFailed = Meter.CreateCounter<long>(
        "releaselab_worker_jobs_failed_total", "jobs", "Total jobs failed in worker");

    public static readonly Histogram<double> ProcessingDuration = Meter.CreateHistogram<double>(
        "releaselab_worker_processing_duration_seconds", "s", "Job processing duration in seconds");

    public static readonly UpDownCounter<long> ActiveJobs = Meter.CreateUpDownCounter<long>(
        "releaselab_worker_active_jobs", "jobs", "Currently processing jobs");
}
