using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Domain.Entities;
using ReleaseLab.Domain.Enums;
using Stripe;
using Stripe.Checkout;

namespace ReleaseLab.Infrastructure.Payments.Services;

public class StripeSubscriptionService : ISubscriptionService
{
    private readonly IAppDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<StripeSubscriptionService> _logger;

    private static readonly Dictionary<UserPlan, string> PlanPriceIds = new();

    public StripeSubscriptionService(IAppDbContext db, IConfiguration config, ILogger<StripeSubscriptionService> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
        StripeConfiguration.ApiKey = _config["Stripe:SecretKey"];

        // Load price IDs from config
        var proPriceId = _config["Stripe:ProPriceId"];
        var studioPriceId = _config["Stripe:StudioPriceId"];
        if (!string.IsNullOrEmpty(proPriceId)) PlanPriceIds[UserPlan.Pro] = proPriceId;
        if (!string.IsNullOrEmpty(studioPriceId)) PlanPriceIds[UserPlan.Studio] = studioPriceId;
    }

    public async Task<string> CreateCheckoutSessionAsync(Guid userId, string email, UserPlan plan, string successUrl, string cancelUrl)
    {
        if (plan == UserPlan.Free)
            throw new ArgumentException("Cannot subscribe to free plan");

        // Get or create Stripe customer
        var existingSub = await _db.Subscriptions.FirstOrDefaultAsync(s => s.UserId == userId);
        string customerId;

        if (existingSub?.StripeCustomerId is not null)
        {
            customerId = existingSub.StripeCustomerId;
        }
        else
        {
            var customerService = new CustomerService();
            var customer = await customerService.CreateAsync(new CustomerCreateOptions
            {
                Email = email,
                Metadata = new Dictionary<string, string> { { "user_id", userId.ToString() } }
            });
            customerId = customer.Id;
        }

        var priceId = PlanPriceIds.GetValueOrDefault(plan);

        var options = new SessionCreateOptions
        {
            Customer = customerId,
            PaymentMethodTypes = new List<string> { "card" },
            Mode = "subscription",
            SuccessUrl = successUrl + "?session_id={CHECKOUT_SESSION_ID}",
            CancelUrl = cancelUrl,
            Metadata = new Dictionary<string, string>
            {
                { "user_id", userId.ToString() },
                { "plan", plan.ToString() }
            }
        };

        if (priceId is not null)
        {
            options.LineItems = new List<SessionLineItemOptions>
            {
                new() { Price = priceId, Quantity = 1 }
            };
        }
        else
        {
            // Create ad-hoc price (dev/test)
            options.LineItems = new List<SessionLineItemOptions>
            {
                new()
                {
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        UnitAmount = PlanLimits.PriceCentsMonthly(plan),
                        Currency = "usd",
                        Recurring = new SessionLineItemPriceDataRecurringOptions { Interval = "month" },
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = $"ReleaseLab {plan} Plan",
                            Description = $"{PlanLimits.MonthlyMasters(plan)} masters/month, up to {PlanLimits.MaxFileSizeBytes(plan) / 1024 / 1024}MB files"
                        }
                    },
                    Quantity = 1
                }
            };
        }

        var service = new SessionService();
        var session = await service.CreateAsync(options);
        return session.Url;
    }

    public async Task<bool> CanCreateMasterAsync(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return false;

        // Credit-based masters always allowed if credits > 0
        if (user.CreditBalance > 0) return true;

        var sub = await _db.Subscriptions
            .Where(s => s.UserId == userId && (s.Status == "active" || s.Status == "trialing"))
            .FirstOrDefaultAsync();

        var plan = sub?.Plan ?? user.Plan;
        var limit = PlanLimits.MonthlyMasters(plan);

        // Count masters this period
        var periodStart = sub?.CurrentPeriodStart ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var mastersThisPeriod = await _db.Jobs
            .CountAsync(j => j.UserId == userId && j.CreatedAt >= periodStart &&
                            j.Status != JobStatus.Cancelled && j.Status != JobStatus.Rejected);

        return mastersThisPeriod < limit;
    }

    public async Task IncrementUsageAsync(Guid userId)
    {
        var sub = await _db.Subscriptions
            .Where(s => s.UserId == userId && (s.Status == "active" || s.Status == "trialing"))
            .FirstOrDefaultAsync();

        if (sub is not null)
        {
            sub.MonthlyMastersUsed++;
            await _db.SaveChangesAsync();
        }
    }

    public async Task HandleSubscriptionWebhookAsync(string json, string signature)
    {
        var webhookSecret = _config["Stripe:WebhookSecret"];
        Event stripeEvent;

        try
        {
            stripeEvent = EventUtility.ConstructEvent(json, signature, webhookSecret);
        }
        catch (StripeException ex)
        {
            _logger.LogWarning(ex, "Stripe webhook signature verification failed");
            throw new InvalidOperationException("Invalid webhook signature");
        }

        switch (stripeEvent.Type)
        {
            case EventTypes.CheckoutSessionCompleted:
                var session = stripeEvent.Data.Object as Session;
                if (session?.Mode == "subscription")
                    await HandleSubscriptionCreated(session);
                break;

            case EventTypes.CustomerSubscriptionUpdated:
                var subUpdated = stripeEvent.Data.Object as Stripe.Subscription;
                if (subUpdated is not null) await HandleSubscriptionUpdated(subUpdated);
                break;

            case EventTypes.CustomerSubscriptionDeleted:
                var subDeleted = stripeEvent.Data.Object as Stripe.Subscription;
                if (subDeleted is not null) await HandleSubscriptionCanceled(subDeleted);
                break;

            case EventTypes.InvoicePaid:
                var invoice = stripeEvent.Data.Object as Invoice;
                if (invoice is not null) await HandleInvoicePaid(invoice);
                break;
        }
    }

    public async Task CancelSubscriptionAsync(Guid userId)
    {
        var sub = await _db.Subscriptions
            .Where(s => s.UserId == userId && s.Status == "active")
            .FirstOrDefaultAsync();

        if (sub?.StripeSubscriptionId is null)
            throw new InvalidOperationException("No active subscription");

        var service = new Stripe.SubscriptionService();
        await service.UpdateAsync(sub.StripeSubscriptionId, new SubscriptionUpdateOptions
        {
            CancelAtPeriodEnd = true
        });

        sub.CanceledAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    private async Task HandleSubscriptionCreated(Session session)
    {
        var userIdStr = session.Metadata.GetValueOrDefault("user_id");
        var planStr = session.Metadata.GetValueOrDefault("plan");
        if (userIdStr is null || planStr is null) return;

        var userId = Guid.Parse(userIdStr);
        if (!Enum.TryParse<UserPlan>(planStr, true, out var plan)) return;

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return;

        // Deactivate old subscription
        var oldSubs = await _db.Subscriptions
            .Where(s => s.UserId == userId && s.Status == "active")
            .ToListAsync();
        foreach (var old in oldSubs) old.Status = "replaced";

        var sub = new Domain.Entities.Subscription
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Plan = plan,
            StripeSubscriptionId = session.SubscriptionId,
            StripeCustomerId = session.CustomerId,
            Status = "active",
            CurrentPeriodStart = DateTime.UtcNow,
            CurrentPeriodEnd = DateTime.UtcNow.AddMonths(1),
            CreatedAt = DateTime.UtcNow
        };

        _db.Subscriptions.Add(sub);
        user.Plan = plan;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Subscription created: user {UserId} → {Plan}", userId, plan);
    }

    private async Task HandleSubscriptionUpdated(Stripe.Subscription stripeSub)
    {
        var sub = await _db.Subscriptions
            .FirstOrDefaultAsync(s => s.StripeSubscriptionId == stripeSub.Id);
        if (sub is null) return;

        sub.Status = stripeSub.Status;

        if (stripeSub.CancelAtPeriodEnd)
            sub.CanceledAt ??= DateTime.UtcNow;

        await _db.SaveChangesAsync();
    }

    private async Task HandleSubscriptionCanceled(Stripe.Subscription stripeSub)
    {
        var sub = await _db.Subscriptions
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.StripeSubscriptionId == stripeSub.Id);
        if (sub is null) return;

        sub.Status = "canceled";
        sub.CanceledAt ??= DateTime.UtcNow;
        sub.User.Plan = UserPlan.Free;
        sub.User.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Subscription canceled: user {UserId}", sub.UserId);
    }

    private async Task HandleInvoicePaid(Invoice invoice)
    {
        // Find subscription by matching customer in our DB
        var customerId = invoice.Customer?.Id;
        if (customerId is null) return;

        var sub = await _db.Subscriptions
            .FirstOrDefaultAsync(s => s.StripeCustomerId == customerId && s.Status == "active");
        if (sub is null) return;

        // Reset monthly usage on new billing period
        sub.MonthlyMastersUsed = 0;
        if (invoice.PeriodStart != default) sub.CurrentPeriodStart = invoice.PeriodStart;
        if (invoice.PeriodEnd != default) sub.CurrentPeriodEnd = invoice.PeriodEnd;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Invoice paid, usage reset for subscription {SubId}", sub.Id);
    }
}
