using System.Reflection;
using FluentAssertions;
using ReleaseLab.Worker.Mastering;

namespace ReleaseLab.Worker.Tests;

public class FFmpegFilterChainTests
{
    private static readonly MethodInfo BuildFilterChainMethod;

    static FFmpegFilterChainTests()
    {
        BuildFilterChainMethod = typeof(MasteringWorker)
            .GetMethod("BuildFilterChain", BindingFlags.NonPublic | BindingFlags.Static)
            ?? throw new InvalidOperationException("BuildFilterChain method not found on MasteringWorker");
    }

    private static string InvokeBuildFilterChain(string preset)
    {
        return (string)BuildFilterChainMethod.Invoke(null, new object[] { preset })!;
    }

    // ── Common structure assertions ──

    [Theory]
    [InlineData("warm")]
    [InlineData("bright")]
    [InlineData("loud")]
    [InlineData("balanced")]
    public void BuildFilterChain_AllPresets_StartWithHighpass(string preset)
    {
        var result = InvokeBuildFilterChain(preset);

        result.Should().StartWith("highpass=f=30");
    }

    [Theory]
    [InlineData("warm")]
    [InlineData("bright")]
    [InlineData("loud")]
    [InlineData("balanced")]
    public void BuildFilterChain_AllPresets_EndWithLimiter(string preset)
    {
        var result = InvokeBuildFilterChain(preset);

        result.Should().EndWith("alimiter=limit=0.95");
    }

    [Theory]
    [InlineData("warm")]
    [InlineData("bright")]
    [InlineData("loud")]
    [InlineData("balanced")]
    public void BuildFilterChain_AllPresets_ContainLoudnorm(string preset)
    {
        var result = InvokeBuildFilterChain(preset);

        result.Should().Contain("loudnorm=");
    }

    [Theory]
    [InlineData("warm")]
    [InlineData("bright")]
    [InlineData("loud")]
    [InlineData("balanced")]
    public void BuildFilterChain_AllPresets_ContainCompressor(string preset)
    {
        var result = InvokeBuildFilterChain(preset);

        result.Should().Contain("acompressor=");
    }

    // ── Warm preset ──

    [Fact]
    public void BuildFilterChain_Warm_BoostsMidLowFrequencies()
    {
        var result = InvokeBuildFilterChain("warm");

        result.Should().Contain("equalizer=f=200:width_type=o:width=2:g=1.5");
    }

    [Fact]
    public void BuildFilterChain_Warm_CutsHighMidFrequencies()
    {
        var result = InvokeBuildFilterChain("warm");

        result.Should().Contain("equalizer=f=3000:width_type=o:width=2:g=-1");
    }

    [Fact]
    public void BuildFilterChain_Warm_UsesStandardLoudness()
    {
        var result = InvokeBuildFilterChain("warm");

        result.Should().Contain("loudnorm=I=-14:TP=-1:LRA=11");
    }

    [Fact]
    public void BuildFilterChain_Warm_HasCorrectCompressorSettings()
    {
        var result = InvokeBuildFilterChain("warm");

        result.Should().Contain("acompressor=threshold=-20dB:ratio=2.5:attack=15:release=250");
    }

    // ── Bright preset ──

    [Fact]
    public void BuildFilterChain_Bright_BoostsHighFrequencies()
    {
        var result = InvokeBuildFilterChain("bright");

        result.Should().Contain("equalizer=f=4000:width_type=o:width=2:g=2");
        result.Should().Contain("equalizer=f=10000:width_type=o:width=2:g=1.5");
    }

    [Fact]
    public void BuildFilterChain_Bright_UsesStandardLoudness()
    {
        var result = InvokeBuildFilterChain("bright");

        result.Should().Contain("loudnorm=I=-14:TP=-1:LRA=9");
    }

    [Fact]
    public void BuildFilterChain_Bright_HasLighterCompression()
    {
        var result = InvokeBuildFilterChain("bright");

        result.Should().Contain("acompressor=threshold=-18dB:ratio=2:attack=10:release=200");
    }

    // ── Loud preset ──

    [Fact]
    public void BuildFilterChain_Loud_BoostsBassAndPresence()
    {
        var result = InvokeBuildFilterChain("loud");

        result.Should().Contain("equalizer=f=80:width_type=o:width=2:g=2");
        result.Should().Contain("equalizer=f=8000:width_type=o:width=2:g=1.5");
    }

    [Fact]
    public void BuildFilterChain_Loud_UsesHigherLoudnessTarget()
    {
        var result = InvokeBuildFilterChain("loud");

        // -9 LUFS is significantly louder than -14 LUFS
        result.Should().Contain("loudnorm=I=-9:TP=-1:LRA=7");
    }

    [Fact]
    public void BuildFilterChain_Loud_UsesHeavierCompression()
    {
        var result = InvokeBuildFilterChain("loud");

        result.Should().Contain("acompressor=threshold=-18dB:ratio=3:attack=10:release=200");
    }

    // ── Balanced (default) preset ──

    [Fact]
    public void BuildFilterChain_Balanced_AppliesSubtleEQ()
    {
        var result = InvokeBuildFilterChain("balanced");

        result.Should().Contain("equalizer=f=200:width_type=o:width=2:g=0.5");
        result.Should().Contain("equalizer=f=5000:width_type=o:width=2:g=0.5");
    }

    [Fact]
    public void BuildFilterChain_Balanced_UsesStandardLoudness()
    {
        var result = InvokeBuildFilterChain("balanced");

        result.Should().Contain("loudnorm=I=-14:TP=-1:LRA=11");
    }

    [Fact]
    public void BuildFilterChain_Balanced_UsesModerateCompression()
    {
        var result = InvokeBuildFilterChain("balanced");

        result.Should().Contain("acompressor=threshold=-20dB:ratio=2:attack=12:release=200");
    }

    // ── Default/unknown preset falls back to balanced ──

    [Theory]
    [InlineData("unknown")]
    [InlineData("INVALID")]
    [InlineData("")]
    public void BuildFilterChain_UnknownPreset_FallsBackToBalanced(string preset)
    {
        var balanced = InvokeBuildFilterChain("balanced");
        var result = InvokeBuildFilterChain(preset);

        result.Should().Be(balanced);
    }

    // ── Case insensitivity ──

    [Theory]
    [InlineData("WARM", "warm")]
    [InlineData("Bright", "bright")]
    [InlineData("LOUD", "loud")]
    [InlineData("Balanced", "balanced")]
    public void BuildFilterChain_IsCaseInsensitive(string upper, string lower)
    {
        var resultUpper = InvokeBuildFilterChain(upper);
        var resultLower = InvokeBuildFilterChain(lower);

        resultUpper.Should().Be(resultLower);
    }

    // ── Filter chain structure ──

    [Theory]
    [InlineData("warm")]
    [InlineData("bright")]
    [InlineData("loud")]
    [InlineData("balanced")]
    public void BuildFilterChain_AllPresets_HaveSevenFilters(string preset)
    {
        var result = InvokeBuildFilterChain(preset);

        // Filters are comma-separated: highpass, eq1, eq2, compressor, stereotools, loudnorm, limiter
        var filters = result.Split(',');
        filters.Should().HaveCount(7);
    }
}
