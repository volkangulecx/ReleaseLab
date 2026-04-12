using FluentAssertions;
using ReleaseLab.Domain.Entities;
using ReleaseLab.Domain.Enums;

namespace ReleaseLab.UnitTests;

public class CreditLedgerTests
{
    // ── Balance Calculation ──

    [Fact]
    public void CreditBalance_SinglePurchase_ReflectsCorrectBalance()
    {
        var userId = Guid.NewGuid();
        var entries = new List<CreditLedgerEntry>
        {
            CreateEntry(userId, delta: 100, reason: CreditReason.Purchase, balanceAfter: 100)
        };

        var finalBalance = entries.Last().BalanceAfter;

        finalBalance.Should().Be(100);
    }

    [Fact]
    public void CreditBalance_PurchaseThenJob_ReducesBalance()
    {
        var userId = Guid.NewGuid();
        var entries = new List<CreditLedgerEntry>
        {
            CreateEntry(userId, delta: 100, reason: CreditReason.Purchase, balanceAfter: 100),
            CreateEntry(userId, delta: -10, reason: CreditReason.Job, balanceAfter: 90)
        };

        var finalBalance = entries.Last().BalanceAfter;

        finalBalance.Should().Be(90);
    }

    [Fact]
    public void CreditBalance_SumOfDeltas_MatchesFinalBalance()
    {
        var userId = Guid.NewGuid();
        var entries = new List<CreditLedgerEntry>
        {
            CreateEntry(userId, delta: 100, reason: CreditReason.Purchase, balanceAfter: 100),
            CreateEntry(userId, delta: -10, reason: CreditReason.Job, balanceAfter: 90),
            CreateEntry(userId, delta: -10, reason: CreditReason.Job, balanceAfter: 80),
            CreateEntry(userId, delta: 50, reason: CreditReason.Purchase, balanceAfter: 130),
        };

        var sumOfDeltas = entries.Sum(e => e.Delta);
        var finalBalance = entries.Last().BalanceAfter;

        sumOfDeltas.Should().Be(finalBalance);
    }

    [Fact]
    public void CreditBalance_MultipleTransactions_TrackRunningBalance()
    {
        var userId = Guid.NewGuid();
        var entries = new List<CreditLedgerEntry>();
        var runningBalance = 0;

        // Purchase 200 credits
        runningBalance += 200;
        entries.Add(CreateEntry(userId, delta: 200, reason: CreditReason.Purchase, balanceAfter: runningBalance));

        // Use 25 credits for a job
        runningBalance -= 25;
        entries.Add(CreateEntry(userId, delta: -25, reason: CreditReason.Job, balanceAfter: runningBalance));

        // Refund 25 credits
        runningBalance += 25;
        entries.Add(CreateEntry(userId, delta: 25, reason: CreditReason.Refund, balanceAfter: runningBalance));

        // Bonus 10 credits
        runningBalance += 10;
        entries.Add(CreateEntry(userId, delta: 10, reason: CreditReason.Bonus, balanceAfter: runningBalance));

        entries[0].BalanceAfter.Should().Be(200);
        entries[1].BalanceAfter.Should().Be(175);
        entries[2].BalanceAfter.Should().Be(200);
        entries[3].BalanceAfter.Should().Be(210);
    }

    // ── Deduction ──

    [Fact]
    public void Deduction_CreatesNegativeDelta()
    {
        var userId = Guid.NewGuid();
        var deduction = CreateEntry(userId, delta: -10, reason: CreditReason.Job, balanceAfter: 90);

        deduction.Delta.Should().BeNegative();
        deduction.Reason.Should().Be(CreditReason.Job);
    }

    [Fact]
    public void Deduction_CanReferenceJobId()
    {
        var userId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var entry = CreateEntry(userId, delta: -10, reason: CreditReason.Job, balanceAfter: 90);
        entry.RefJobId = jobId;

        entry.RefJobId.Should().Be(jobId);
        entry.RefPaymentId.Should().BeNull();
    }

    [Fact]
    public void Deduction_MultipleJobs_DecreasesBalanceCorrectly()
    {
        var userId = Guid.NewGuid();
        var initialBalance = 100;
        var jobCost = 10;
        var numberOfJobs = 5;

        var entries = new List<CreditLedgerEntry>();
        var balance = initialBalance;
        entries.Add(CreateEntry(userId, delta: initialBalance, reason: CreditReason.Purchase, balanceAfter: balance));

        for (var i = 0; i < numberOfJobs; i++)
        {
            balance -= jobCost;
            entries.Add(CreateEntry(userId, delta: -jobCost, reason: CreditReason.Job, balanceAfter: balance));
        }

        entries.Last().BalanceAfter.Should().Be(initialBalance - (jobCost * numberOfJobs));
        entries.Last().BalanceAfter.Should().Be(50);
    }

    [Fact]
    public void Deduction_CanReduceBalanceToZero()
    {
        var userId = Guid.NewGuid();
        var entries = new List<CreditLedgerEntry>
        {
            CreateEntry(userId, delta: 50, reason: CreditReason.Purchase, balanceAfter: 50),
            CreateEntry(userId, delta: -50, reason: CreditReason.Job, balanceAfter: 0)
        };

        entries.Last().BalanceAfter.Should().Be(0);
    }

    // ── Refund ──

    [Fact]
    public void Refund_CreatesPositiveDelta()
    {
        var userId = Guid.NewGuid();
        var refund = CreateEntry(userId, delta: 10, reason: CreditReason.Refund, balanceAfter: 100);

        refund.Delta.Should().BePositive();
        refund.Reason.Should().Be(CreditReason.Refund);
    }

    [Fact]
    public void Refund_RestoresBalance()
    {
        var userId = Guid.NewGuid();
        var jobId = Guid.NewGuid();

        var entries = new List<CreditLedgerEntry>
        {
            CreateEntry(userId, delta: 100, reason: CreditReason.Purchase, balanceAfter: 100),
            CreateEntry(userId, delta: -10, reason: CreditReason.Job, balanceAfter: 90),
            CreateEntry(userId, delta: 10, reason: CreditReason.Refund, balanceAfter: 100)
        };
        entries[1].RefJobId = jobId;
        entries[2].RefJobId = jobId;

        entries.Last().BalanceAfter.Should().Be(entries.First().BalanceAfter);
    }

    [Fact]
    public void Refund_CanReferencePaymentId()
    {
        var userId = Guid.NewGuid();
        var paymentId = Guid.NewGuid();
        var entry = CreateEntry(userId, delta: 50, reason: CreditReason.Refund, balanceAfter: 150);
        entry.RefPaymentId = paymentId;

        entry.RefPaymentId.Should().Be(paymentId);
    }

    // ── User Integration ──

    [Fact]
    public void User_CreditEntries_Collection_TracksAllEntries()
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "test@example.com",
            PasswordHash = "hash",
            CreditBalance = 90,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var entry1 = CreateEntry(user.Id, delta: 100, reason: CreditReason.Purchase, balanceAfter: 100);
        var entry2 = CreateEntry(user.Id, delta: -10, reason: CreditReason.Job, balanceAfter: 90);

        user.CreditEntries.Add(entry1);
        user.CreditEntries.Add(entry2);

        user.CreditEntries.Should().HaveCount(2);
        user.CreditEntries.Sum(e => e.Delta).Should().Be(user.CreditBalance);
    }

    // ── Helpers ──

    private static CreditLedgerEntry CreateEntry(
        Guid userId,
        int delta,
        CreditReason reason,
        int balanceAfter)
    {
        return new CreditLedgerEntry
        {
            UserId = userId,
            Delta = delta,
            Reason = reason,
            BalanceAfter = balanceAfter,
            CreatedAt = DateTime.UtcNow
        };
    }
}
