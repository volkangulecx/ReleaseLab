using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = default!;
    public string PasswordHash { get; set; } = default!;
    public string? DisplayName { get; set; }
    public UserPlan Plan { get; set; } = UserPlan.Free;
    public bool EmailVerified { get; set; }
    public int CreditBalance { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<AudioFile> Files { get; set; } = new List<AudioFile>();
    public ICollection<Job> Jobs { get; set; } = new List<Job>();
    public ICollection<CreditLedgerEntry> CreditEntries { get; set; } = new List<CreditLedgerEntry>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
