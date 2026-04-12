using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Domain.Entities;

public class Subscription
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public UserPlan Plan { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public string? StripeCustomerId { get; set; }
    public string Status { get; set; } = "active"; // active | canceled | past_due | trialing
    public DateTime CurrentPeriodStart { get; set; }
    public DateTime CurrentPeriodEnd { get; set; }
    public int MonthlyMastersUsed { get; set; }
    public DateTime? CanceledAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = default!;

    public bool IsActive => Status == "active" || Status == "trialing";
}
