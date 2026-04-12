namespace ReleaseLab.Application.Interfaces;

public record AudioAnalysisResult(
    double DurationSeconds,
    int SampleRate,
    int Channels,
    string Codec,
    double PeakDb,
    double LoudnessLufs,
    float[] WaveformData  // normalized 0-1, ~200 samples for visualization
);

public interface IAudioAnalysisService
{
    Task<AudioAnalysisResult> AnalyzeAsync(string filePath, CancellationToken ct = default);
}
