using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Domain.Entities;

public class CreditLedgerEntry
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public int Delta { get; set; }
    public CreditReason Reason { get; set; }
    public Guid? RefJobId { get; set; }
    public Guid? RefPaymentId { get; set; }
    public int BalanceAfter { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = default!;
}
