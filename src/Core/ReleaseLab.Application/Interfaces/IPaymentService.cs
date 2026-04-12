namespace ReleaseLab.Application.Interfaces;

public interface IPaymentService
{
    Task<string> CreateCheckoutSessionAsync(Guid userId, string email, int creditAmount, string successUrl, string cancelUrl);
    Task HandleWebhookAsync(string json, string stripeSignature);
}
