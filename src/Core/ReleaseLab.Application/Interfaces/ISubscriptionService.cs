using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Application.Interfaces;

public interface ISubscriptionService
{
    Task<string> CreateCheckoutSessionAsync(Guid userId, string email, UserPlan plan, string successUrl, string cancelUrl);
    Task<bool> CanCreateMasterAsync(Guid userId);
    Task IncrementUsageAsync(Guid userId);
    Task HandleSubscriptionWebhookAsync(string json, string signature);
    Task CancelSubscriptionAsync(Guid userId);
}
