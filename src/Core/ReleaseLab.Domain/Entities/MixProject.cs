namespace ReleaseLab.Domain.Entities;

public class MixProject
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Name { get; set; } = default!;
    public string Status { get; set; } = "draft"; // draft | mixing | completed | failed
    public short Progress { get; set; }
    public string? OutputS3Key { get; set; }
    public string? ErrorMessage { get; set; }
    public int CreditsCost { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public User User { get; set; } = default!;
    public ICollection<MixTrack> Tracks { get; set; } = new List<MixTrack>();
}
