using FluentAssertions;
using ReleaseLab.Domain.Entities;

namespace ReleaseLab.UnitTests;

public class MixingTests
{
    // ── MixTrack Volume Clamping ──

    [Fact]
    public void MixTrack_DefaultVolume_IsOne()
    {
        var track = new MixTrack();

        track.Volume.Should().Be(1.0);
    }

    [Fact]
    public void MixTrack_Volume_CanBeSetWithinRange()
    {
        var track = new MixTrack();

        track.Volume = 1.5;

        track.Volume.Should().Be(1.5);
    }

    [Fact]
    public void MixTrack_Volume_ClampedToZeroWhenNegative()
    {
        var track = new MixTrack();

        track.Volume = Math.Clamp(-0.5, 0, 2);

        track.Volume.Should().Be(0.0);
    }

    [Fact]
    public void MixTrack_Volume_ClampedToTwoWhenExceeds()
    {
        var track = new MixTrack();

        track.Volume = Math.Clamp(3.0, 0, 2);

        track.Volume.Should().Be(2.0);
    }

    [Fact]
    public void MixTrack_Volume_ClampAtLowerBoundary()
    {
        var track = new MixTrack();

        track.Volume = Math.Clamp(0.0, 0, 2);

        track.Volume.Should().Be(0.0);
    }

    [Fact]
    public void MixTrack_Volume_ClampAtUpperBoundary()
    {
        var track = new MixTrack();

        track.Volume = Math.Clamp(2.0, 0, 2);

        track.Volume.Should().Be(2.0);
    }

    // ── MixTrack Pan Clamping ──

    [Fact]
    public void MixTrack_DefaultPan_IsCenter()
    {
        var track = new MixTrack();

        track.Pan.Should().Be(0.0);
    }

    [Fact]
    public void MixTrack_Pan_CanBeSetWithinRange()
    {
        var track = new MixTrack();

        track.Pan = 0.5;

        track.Pan.Should().Be(0.5);
    }

    [Fact]
    public void MixTrack_Pan_ClampedToNegativeOneWhenBelowRange()
    {
        var track = new MixTrack();

        track.Pan = Math.Clamp(-2.0, -1, 1);

        track.Pan.Should().Be(-1.0);
    }

    [Fact]
    public void MixTrack_Pan_ClampedToOneWhenAboveRange()
    {
        var track = new MixTrack();

        track.Pan = Math.Clamp(1.5, -1, 1);

        track.Pan.Should().Be(1.0);
    }

    [Fact]
    public void MixTrack_Pan_ClampAtLeftBoundary()
    {
        var track = new MixTrack();

        track.Pan = Math.Clamp(-1.0, -1, 1);

        track.Pan.Should().Be(-1.0);
    }

    [Fact]
    public void MixTrack_Pan_ClampAtRightBoundary()
    {
        var track = new MixTrack();

        track.Pan = Math.Clamp(1.0, -1, 1);

        track.Pan.Should().Be(1.0);
    }

    // ── MixProject Status Transitions ──

    [Fact]
    public void MixProject_DefaultStatus_IsDraft()
    {
        var project = new MixProject();

        project.Status.Should().Be("draft");
    }

    [Fact]
    public void MixProject_StatusTransition_DraftToMixing()
    {
        var project = new MixProject { Status = "draft" };

        project.Status = "mixing";

        project.Status.Should().Be("mixing");
    }

    [Fact]
    public void MixProject_StatusTransition_MixingToCompleted()
    {
        var project = new MixProject { Status = "mixing" };

        project.Status = "completed";
        project.CompletedAt = DateTime.UtcNow;

        project.Status.Should().Be("completed");
        project.CompletedAt.Should().NotBeNull();
    }

    [Fact]
    public void MixProject_StatusTransition_MixingToFailed()
    {
        var project = new MixProject { Status = "mixing" };

        project.Status = "failed";
        project.ErrorMessage = "FFmpeg error";

        project.Status.Should().Be("failed");
        project.ErrorMessage.Should().Be("FFmpeg error");
    }

    [Fact]
    public void MixProject_Progress_DefaultsToZero()
    {
        var project = new MixProject();

        project.Progress.Should().Be(0);
    }

    [Fact]
    public void MixProject_Progress_CanTrackCompletion()
    {
        var project = new MixProject();

        project.Progress = 50;
        project.Progress.Should().Be(50);

        project.Progress = 100;
        project.Progress.Should().Be(100);
    }

    // ── MixProject with Multiple Tracks ──

    [Fact]
    public void MixProject_Tracks_DefaultsToEmptyCollection()
    {
        var project = new MixProject();

        project.Tracks.Should().NotBeNull();
        project.Tracks.Should().BeEmpty();
    }

    [Fact]
    public void MixProject_AddTrack_IncreasesTrackCount()
    {
        var project = new MixProject();
        var track = new MixTrack
        {
            Id = Guid.NewGuid(),
            Name = "Vocals",
            OrderIndex = 0,
        };

        project.Tracks.Add(track);

        project.Tracks.Should().HaveCount(1);
        project.Tracks.First().Name.Should().Be("Vocals");
    }

    [Fact]
    public void MixProject_MultipleTracks_MaintainOrder()
    {
        var project = new MixProject();

        project.Tracks.Add(new MixTrack { Name = "Drums", OrderIndex = 0 });
        project.Tracks.Add(new MixTrack { Name = "Bass", OrderIndex = 1 });
        project.Tracks.Add(new MixTrack { Name = "Vocals", OrderIndex = 2 });
        project.Tracks.Add(new MixTrack { Name = "Guitar", OrderIndex = 3 });

        project.Tracks.Should().HaveCount(4);
        project.Tracks.OrderBy(t => t.OrderIndex)
            .Select(t => t.Name)
            .Should().ContainInOrder("Drums", "Bass", "Vocals", "Guitar");
    }

    [Fact]
    public void MixProject_Tracks_EachTrackHasIndependentSettings()
    {
        var project = new MixProject();

        var vocals = new MixTrack { Name = "Vocals", Volume = 1.2, Pan = -0.3, Muted = false, Solo = true };
        var drums = new MixTrack { Name = "Drums", Volume = 0.8, Pan = 0.0, Muted = true, Solo = false };

        project.Tracks.Add(vocals);
        project.Tracks.Add(drums);

        var v = project.Tracks.First(t => t.Name == "Vocals");
        v.Volume.Should().Be(1.2);
        v.Pan.Should().Be(-0.3);
        v.Solo.Should().BeTrue();
        v.Muted.Should().BeFalse();

        var d = project.Tracks.First(t => t.Name == "Drums");
        d.Volume.Should().Be(0.8);
        d.Pan.Should().Be(0.0);
        d.Muted.Should().BeTrue();
        d.Solo.Should().BeFalse();
    }

    [Fact]
    public void MixTrack_Defaults_MutedAndSoloAreFalse()
    {
        var track = new MixTrack();

        track.Muted.Should().BeFalse();
        track.Solo.Should().BeFalse();
    }

    [Fact]
    public void MixProject_NewProject_HasRequiredFields()
    {
        var userId = Guid.NewGuid();
        var project = new MixProject
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = "My Mix",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        project.Id.Should().NotBeEmpty();
        project.UserId.Should().Be(userId);
        project.Name.Should().Be("My Mix");
        project.Status.Should().Be("draft");
        project.Progress.Should().Be(0);
        project.OutputS3Key.Should().BeNull();
        project.ErrorMessage.Should().BeNull();
        project.CompletedAt.Should().BeNull();
    }
}
