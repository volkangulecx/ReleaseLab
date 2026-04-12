namespace ReleaseLab.Api.Extensions;

public static class FileValidationExtensions
{
    // Magic number signatures for audio formats
    private static readonly Dictionary<string, byte[][]> AudioSignatures = new()
    {
        { "audio/wav", new[] { new byte[] { 0x52, 0x49, 0x46, 0x46 } } },           // RIFF
        { "audio/x-wav", new[] { new byte[] { 0x52, 0x49, 0x46, 0x46 } } },         // RIFF
        { "audio/mpeg", new[] {
            new byte[] { 0xFF, 0xFB },                                                // MP3 frame sync
            new byte[] { 0xFF, 0xF3 },
            new byte[] { 0xFF, 0xF2 },
            new byte[] { 0x49, 0x44, 0x33 }                                           // ID3
        }},
        { "audio/flac", new[] { new byte[] { 0x66, 0x4C, 0x61, 0x43 } } },          // fLaC
        { "audio/x-flac", new[] { new byte[] { 0x66, 0x4C, 0x61, 0x43 } } }
    };

    public static bool IsValidAudioMagicNumber(Stream stream, string contentType)
    {
        if (!AudioSignatures.TryGetValue(contentType.ToLowerInvariant(), out var signatures))
            return false;

        var buffer = new byte[4];
        var originalPosition = stream.Position;
        stream.Position = 0;
        var bytesRead = stream.Read(buffer, 0, 4);
        stream.Position = originalPosition;

        if (bytesRead < 2)
            return false;

        foreach (var signature in signatures)
        {
            if (buffer.AsSpan(0, signature.Length).SequenceEqual(signature))
                return true;
        }

        return false;
    }

    public static long GetMaxFileSizeBytes(string plan)
    {
        return plan.ToLowerInvariant() switch
        {
            "studio" => 500L * 1024 * 1024,   // 500MB
            "pro" => 200L * 1024 * 1024,       // 200MB
            _ => 50L * 1024 * 1024             // 50MB free
        };
    }

    public static readonly string[] AllowedContentTypes =
    {
        "audio/wav", "audio/x-wav", "audio/mpeg", "audio/flac", "audio/x-flac"
    };
}
