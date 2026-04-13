namespace ReleaseLab.Domain.Entities;

public class MixTrack
{
    public Guid Id { get; set; }
    public Guid MixProjectId { get; set; }
    public Guid FileId { get; set; }
    public string Name { get; set; } = default!;
    public double Volume { get; set; } = 1.0;       // 0.0 to 2.0
    public double Pan { get; set; } = 0.0;          // -1.0 (left) to 1.0 (right)
    public bool Muted { get; set; }
    public bool Solo { get; set; }
    public int OrderIndex { get; set; }
    public string? Color { get; set; }               // Track color hex (#8b5cf6)
    public string? EqPreset { get; set; }            // none | vocal | drums | bass | guitar | keys | bright | warm
    public double LowGain { get; set; }              // -12 to +12 dB (low shelf 200Hz)
    public double MidGain { get; set; }              // -12 to +12 dB (peak 1kHz)
    public double HighGain { get; set; }             // -12 to +12 dB (high shelf 8kHz)
    public double ReverbAmount { get; set; }         // 0.0 to 1.0
    public double CompressorThreshold { get; set; }  // -60 to 0 dB (0 = off)
    public DateTime CreatedAt { get; set; }

    public MixProject Project { get; set; } = default!;
    public AudioFile File { get; set; } = default!;
}
