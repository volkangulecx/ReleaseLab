namespace ReleaseLab.Domain.Entities;

public class AuditLog
{
    public long Id { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = default!;        // e.g. "admin.add_credits", "admin.change_plan", "credit.purchase"
    public string? TargetType { get; set; }                // "User", "Job", "Payment"
    public string? TargetId { get; set; }
    public string? Details { get; set; }                   // JSON details
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; }
}
