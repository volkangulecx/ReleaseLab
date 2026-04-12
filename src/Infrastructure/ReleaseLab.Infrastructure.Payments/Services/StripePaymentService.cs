using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Domain.Entities;
using ReleaseLab.Domain.Enums;
using Stripe;
using Stripe.Checkout;

namespace ReleaseLab.Infrastructure.Payments.Services;

public class StripePaymentService : IPaymentService
{
    private readonly IAppDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<StripePaymentService> _logger;

    private static readonly Dictionary<int, (int priceCents, string description)> CreditPackages = new()
    {
        { 5, (500, "5 Credits") },
        { 15, (1200, "15 Credits (20% off)") },
        { 50, (3500, "50 Credits (30% off)") }
    };

    public StripePaymentService(IAppDbContext db, IConfiguration config, ILogger<StripePaymentService> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
        StripeConfiguration.ApiKey = _config["Stripe:SecretKey"];
    }

    public async Task<string> CreateCheckoutSessionAsync(Guid userId, string email, int creditAmount, string successUrl, string cancelUrl)
    {
        if (!CreditPackages.TryGetValue(creditAmount, out var package))
            throw new ArgumentException($"Invalid credit amount. Available: {string.Join(", ", CreditPackages.Keys)}");

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AmountCents = package.priceCents,
            Currency = "usd",
            Status = PaymentStatus.Pending,
            CreditsGranted = creditAmount,
            CreatedAt = DateTime.UtcNow
        };

        _db.Payments.Add(payment);
        await _db.SaveChangesAsync();

        var options = new SessionCreateOptions
        {
            PaymentMethodTypes = new List<string> { "card" },
            CustomerEmail = email,
            LineItems = new List<SessionLineItemOptions>
            {
                new()
                {
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        UnitAmount = package.priceCents,
                        Currency = "usd",
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = $"ReleaseLab {package.description}",
                            Description = $"{creditAmount} mastering credits for ReleaseLab"
                        }
                    },
                    Quantity = 1
                }
            },
            Mode = "payment",
            SuccessUrl = successUrl + "?session_id={CHECKOUT_SESSION_ID}",
            CancelUrl = cancelUrl,
            Metadata = new Dictionary<string, string>
            {
                { "payment_id", payment.Id.ToString() },
                { "user_id", userId.ToString() },
                { "credits", creditAmount.ToString() }
            }
        };

        var service = new SessionService();
        var session = await service.CreateAsync(options);

        payment.StripeSessionId = session.Id;
        await _db.SaveChangesAsync();

        return session.Url;
    }

    public async Task HandleWebhookAsync(string json, string stripeSignature)
    {
        var webhookSecret = _config["Stripe:WebhookSecret"];
        Event stripeEvent;

        try
        {
            stripeEvent = EventUtility.ConstructEvent(json, stripeSignature, webhookSecret);
        }
        catch (StripeException ex)
        {
            _logger.LogWarning(ex, "Stripe webhook signature verification failed");
            throw new InvalidOperationException("Invalid webhook signature");
        }

        if (stripeEvent.Type == EventTypes.CheckoutSessionCompleted)
        {
            var session = stripeEvent.Data.Object as Session;
            if (session is null) return;

            await HandleCheckoutCompleted(session);
        }
        else if (stripeEvent.Type == EventTypes.PaymentIntentPaymentFailed)
        {
            var paymentIntent = stripeEvent.Data.Object as PaymentIntent;
            if (paymentIntent is null) return;

            _logger.LogWarning("Payment failed for PI {PaymentIntentId}", paymentIntent.Id);
        }
    }

    private async Task HandleCheckoutCompleted(Session session)
    {
        var paymentIdStr = session.Metadata.GetValueOrDefault("payment_id");
        var userIdStr = session.Metadata.GetValueOrDefault("user_id");
        var creditsStr = session.Metadata.GetValueOrDefault("credits");

        if (paymentIdStr is null || userIdStr is null || creditsStr is null)
        {
            _logger.LogWarning("Webhook missing metadata: session {SessionId}", session.Id);
            return;
        }

        var paymentId = Guid.Parse(paymentIdStr);
        var userId = Guid.Parse(userIdStr);
        var credits = int.Parse(creditsStr);

        var payment = await _db.Payments.FindAsync(paymentId);
        if (payment is null || payment.Status == PaymentStatus.Succeeded)
        {
            _logger.LogInformation("Payment {PaymentId} already processed or not found, skipping", paymentId);
            return;
        }

        payment.Status = PaymentStatus.Succeeded;
        payment.StripePaymentIntentId = session.PaymentIntentId;

        var user = await _db.Users.FindAsync(userId);
        if (user is null)
        {
            _logger.LogError("User {UserId} not found for payment {PaymentId}", userId, paymentId);
            return;
        }

        user.CreditBalance += credits;

        _db.CreditLedgerEntries.Add(new CreditLedgerEntry
        {
            UserId = userId,
            Delta = credits,
            Reason = CreditReason.Purchase,
            RefPaymentId = paymentId,
            BalanceAfter = user.CreditBalance,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        _logger.LogInformation("Granted {Credits} credits to user {UserId} via payment {PaymentId}", credits, userId, paymentId);
    }
}
