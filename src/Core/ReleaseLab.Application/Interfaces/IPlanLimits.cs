using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Application.Interfaces;

public static class PlanLimits
{
    public static int MonthlyMasters(UserPlan plan) => plan switch
    {
        UserPlan.Free => 1,
        UserPlan.Pro => 20,
        UserPlan.Studio => 100,
        _ => 1
    };

    public static long MaxFileSizeBytes(UserPlan plan) => plan switch
    {
        UserPlan.Free => 50L * 1024 * 1024,
        UserPlan.Pro => 200L * 1024 * 1024,
        UserPlan.Studio => 500L * 1024 * 1024,
        _ => 50L * 1024 * 1024
    };

    public static string[] AllowedFormats(UserPlan plan) => plan switch
    {
        UserPlan.Studio => new[] { "wav", "mp3", "flac" },
        UserPlan.Pro => new[] { "wav", "mp3", "flac" },
        _ => new[] { "wav", "mp3", "flac" }
    };

    public static string[] MasterOutputFormats(UserPlan plan) => plan switch
    {
        UserPlan.Studio => new[] { "wav", "mp3_320", "flac" },
        UserPlan.Pro => new[] { "wav", "mp3_320" },
        _ => new[] { "mp3_320" }
    };

    public static bool HasPriorityQueue(UserPlan plan) => plan != UserPlan.Free;

    public static string QueueName(UserPlan plan) => plan switch
    {
        UserPlan.Studio => "queue:mastering:priority-high",
        UserPlan.Pro => "queue:mastering:priority-normal",
        _ => "queue:mastering:priority-low"
    };

    public static int PriceCentsMonthly(UserPlan plan) => plan switch
    {
        UserPlan.Pro => 900,
        UserPlan.Studio => 2900,
        _ => 0
    };
}
