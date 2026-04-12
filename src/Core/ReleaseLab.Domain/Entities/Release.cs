namespace ReleaseLab.Domain.Entities;

public class Release
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid? JobId { get; set; }             // linked mastered track
    public Guid? MixProjectId { get; set; }      // or linked mix project

    // Metadata
    public string Title { get; set; } = default!;
    public string Artist { get; set; } = default!;
    public string? Album { get; set; }
    public string? Genre { get; set; }
    public string? Isrc { get; set; }             // International Standard Recording Code
    public string? Upc { get; set; }              // Universal Product Code
    public int? Year { get; set; }
    public string? Language { get; set; }
    public string? Copyright { get; set; }
    public string? Description { get; set; }

    // Artwork
    public string? ArtworkS3Key { get; set; }

    // Audio
    public string? AudioS3Key { get; set; }

    // Distribution
    public string Status { get; set; } = "draft";  // draft | review | scheduled | submitted | live | rejected
    public string? DistributorId { get; set; }      // distrokid | tunecore | custom
    public string? ExternalReleaseId { get; set; }
    public DateTime? ScheduledReleaseDate { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? LiveAt { get; set; }

    // Platforms
    public bool Spotify { get; set; } = true;
    public bool AppleMusic { get; set; } = true;
    public bool YouTube { get; set; } = true;
    public bool AmazonMusic { get; set; } = true;
    public bool Tidal { get; set; } = true;
    public bool Deezer { get; set; } = true;

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = default!;
}
