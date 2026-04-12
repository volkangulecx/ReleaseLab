namespace ReleaseLab.Domain.Entities;

public class VerificationCode
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Code { get; set; } = default!;
    public string Purpose { get; set; } = default!; // "email_verify" | "password_reset"
    public DateTime ExpiresAt { get; set; }
    public bool Used { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = default!;

    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsValid => !IsExpired && !Used;
}
