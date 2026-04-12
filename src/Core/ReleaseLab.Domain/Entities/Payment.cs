using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Domain.Entities;

public class Payment
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string? StripeSessionId { get; set; }
    public string? StripePaymentIntentId { get; set; }
    public int AmountCents { get; set; }
    public string Currency { get; set; } = "usd";
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public int CreditsGranted { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = default!;
}
