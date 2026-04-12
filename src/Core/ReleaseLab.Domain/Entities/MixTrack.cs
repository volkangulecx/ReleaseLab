namespace ReleaseLab.Domain.Entities;

public class MixTrack
{
    public Guid Id { get; set; }
    public Guid MixProjectId { get; set; }
    public Guid FileId { get; set; }
    public string Name { get; set; } = default!;
    public double Volume { get; set; } = 1.0;    // 0.0 to 2.0
    public double Pan { get; set; } = 0.0;       // -1.0 (left) to 1.0 (right)
    public bool Muted { get; set; }
    public bool Solo { get; set; }
    public int OrderIndex { get; set; }
    public DateTime CreatedAt { get; set; }

    public MixProject Project { get; set; } = default!;
    public AudioFile File { get; set; } = default!;
}
