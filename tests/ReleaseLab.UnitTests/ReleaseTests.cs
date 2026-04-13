using System.Text.RegularExpressions;
using FluentAssertions;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.UnitTests;

public class ReleaseTests
{
    // ── Required Fields ──

    [Fact]
    public void Release_NewRelease_HasTitleAndArtist()
    {
        var release = new Release
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Title = "My Song",
            Artist = "Test Artist",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        release.Title.Should().Be("My Song");
        release.Artist.Should().Be("Test Artist");
    }

    [Fact]
    public void Release_TitleAndArtist_CanBeUpdated()
    {
        var release = new Release { Title = "Original", Artist = "Original Artist" };

        release.Title = "Updated Title";
        release.Artist = "Updated Artist";

        release.Title.Should().Be("Updated Title");
        release.Artist.Should().Be("Updated Artist");
    }

    [Fact]
    public void Release_OptionalFields_DefaultToNull()
    {
        var release = new Release { Title = "Song", Artist = "Artist" };

        release.Album.Should().BeNull();
        release.Genre.Should().BeNull();
        release.Isrc.Should().BeNull();
        release.Upc.Should().BeNull();
        release.Description.Should().BeNull();
        release.ArtworkS3Key.Should().BeNull();
        release.AudioS3Key.Should().BeNull();
        release.DistributorId.Should().BeNull();
        release.ExternalReleaseId.Should().BeNull();
        release.ScheduledReleaseDate.Should().BeNull();
        release.SubmittedAt.Should().BeNull();
        release.LiveAt.Should().BeNull();
    }

    // ── Status Lifecycle ──

    [Fact]
    public void Release_DefaultStatus_IsDraft()
    {
        var release = new Release { Title = "Song", Artist = "Artist" };

        release.Status.Should().Be("draft");
    }

    [Fact]
    public void Release_StatusTransition_DraftToScheduled()
    {
        var release = new Release { Title = "Song", Artist = "Artist", Status = "draft" };

        release.Status = "scheduled";
        release.ScheduledReleaseDate = DateTime.UtcNow.AddDays(7);

        release.Status.Should().Be("scheduled");
        release.ScheduledReleaseDate.Should().NotBeNull();
    }

    [Fact]
    public void Release_StatusTransition_ScheduledToSubmitted()
    {
        var release = new Release { Title = "Song", Artist = "Artist", Status = "scheduled" };

        release.Status = "submitted";
        release.SubmittedAt = DateTime.UtcNow;

        release.Status.Should().Be("submitted");
        release.SubmittedAt.Should().NotBeNull();
    }

    [Fact]
    public void Release_StatusTransition_SubmittedToLive()
    {
        var release = new Release { Title = "Song", Artist = "Artist", Status = "submitted" };

        release.Status = "live";
        release.LiveAt = DateTime.UtcNow;

        release.Status.Should().Be("live");
        release.LiveAt.Should().NotBeNull();
    }

    [Fact]
    public void Release_FullLifecycle_DraftToLive()
    {
        var release = new Release
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Title = "Hit Single",
            Artist = "Famous Artist",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        // draft -> scheduled
        release.Status.Should().Be("draft");
        release.Status = "scheduled";
        release.ScheduledReleaseDate = DateTime.UtcNow.AddDays(14);

        // scheduled -> submitted
        release.Status = "submitted";
        release.SubmittedAt = DateTime.UtcNow;

        // submitted -> live
        release.Status = "live";
        release.LiveAt = DateTime.UtcNow;

        release.Status.Should().Be("live");
        release.ScheduledReleaseDate.Should().NotBeNull();
        release.SubmittedAt.Should().NotBeNull();
        release.LiveAt.Should().NotBeNull();
    }

    [Fact]
    public void Release_StatusTransition_DraftToReview()
    {
        var release = new Release { Title = "Song", Artist = "Artist", Status = "draft" };

        release.Status = "review";

        release.Status.Should().Be("review");
    }

    [Fact]
    public void Release_StatusTransition_CanBeRejected()
    {
        var release = new Release { Title = "Song", Artist = "Artist", Status = "submitted" };

        release.Status = "rejected";

        release.Status.Should().Be("rejected");
    }

    // ── Platform Defaults ──

    [Fact]
    public void Release_AllPlatforms_DefaultToTrue()
    {
        var release = new Release { Title = "Song", Artist = "Artist" };

        release.Spotify.Should().BeTrue();
        release.AppleMusic.Should().BeTrue();
        release.YouTube.Should().BeTrue();
        release.AmazonMusic.Should().BeTrue();
        release.Tidal.Should().BeTrue();
        release.Deezer.Should().BeTrue();
    }

    [Fact]
    public void Release_Platforms_CanBeDisabledIndividually()
    {
        var release = new Release { Title = "Song", Artist = "Artist" };

        release.Spotify = false;
        release.Tidal = false;

        release.Spotify.Should().BeFalse();
        release.AppleMusic.Should().BeTrue();
        release.YouTube.Should().BeTrue();
        release.AmazonMusic.Should().BeTrue();
        release.Tidal.Should().BeFalse();
        release.Deezer.Should().BeTrue();
    }

    [Fact]
    public void Release_Platforms_AllCanBeDisabled()
    {
        var release = new Release { Title = "Song", Artist = "Artist" };

        release.Spotify = false;
        release.AppleMusic = false;
        release.YouTube = false;
        release.AmazonMusic = false;
        release.Tidal = false;
        release.Deezer = false;

        release.Spotify.Should().BeFalse();
        release.AppleMusic.Should().BeFalse();
        release.YouTube.Should().BeFalse();
        release.AmazonMusic.Should().BeFalse();
        release.Tidal.Should().BeFalse();
        release.Deezer.Should().BeFalse();
    }

    // ── ISRC Format Validation Helper ──

    [Theory]
    [InlineData("USRC17607839", true)]   // valid: 2-letter country, 3-char registrant, 2-digit year, 5-digit designation
    [InlineData("GBAYE0000001", true)]   // valid UK code
    [InlineData("DEAB71200001", true)]   // valid DE code
    [InlineData("US-RC1-76-07839", false)] // dashes not allowed in strict format
    [InlineData("INVALID", false)]        // too short
    [InlineData("", false)]               // empty
    [InlineData("USRC1760783", false)]    // 11 chars (too short)
    [InlineData("USRC176078390", false)]  // 13 chars (too long)
    public void IsValidIsrc_ValidatesFormat(string isrc, bool expected)
    {
        var result = IsValidIsrc(isrc);

        result.Should().Be(expected);
    }

    [Fact]
    public void Release_Isrc_CanBeSetWhenValid()
    {
        var release = new Release { Title = "Song", Artist = "Artist" };
        var isrc = "USRC17607839";

        if (IsValidIsrc(isrc))
            release.Isrc = isrc;

        release.Isrc.Should().Be("USRC17607839");
    }

    [Fact]
    public void Release_Isrc_RemainsNullWhenInvalid()
    {
        var release = new Release { Title = "Song", Artist = "Artist" };
        var isrc = "INVALID";

        if (IsValidIsrc(isrc))
            release.Isrc = isrc;

        release.Isrc.Should().BeNull();
    }

    // ── Linked Entities ──

    [Fact]
    public void Release_CanLinkToJob()
    {
        var jobId = Guid.NewGuid();
        var release = new Release { Title = "Song", Artist = "Artist", JobId = jobId };

        release.JobId.Should().Be(jobId);
        release.MixProjectId.Should().BeNull();
    }

    [Fact]
    public void Release_CanLinkToMixProject()
    {
        var mixProjectId = Guid.NewGuid();
        var release = new Release { Title = "Song", Artist = "Artist", MixProjectId = mixProjectId };

        release.MixProjectId.Should().Be(mixProjectId);
        release.JobId.Should().BeNull();
    }

    // ── Year and Language Defaults ──

    [Fact]
    public void Release_Year_DefaultsToNull()
    {
        var release = new Release { Title = "Song", Artist = "Artist" };

        release.Year.Should().BeNull();
    }

    [Fact]
    public void Release_Language_DefaultsToNull()
    {
        var release = new Release { Title = "Song", Artist = "Artist" };

        release.Language.Should().BeNull();
    }

    // ── Helper: ISRC validation (matches standard 12-character alphanumeric format) ──

    private static bool IsValidIsrc(string isrc)
    {
        if (string.IsNullOrWhiteSpace(isrc)) return false;
        // ISRC format: 2 letter country code + 3 alphanumeric registrant + 2 digit year + 5 digit designation = 12 chars
        return Regex.IsMatch(isrc, @"^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$");
    }
}
