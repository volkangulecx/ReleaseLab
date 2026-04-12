"""
Reference Track Matching — analyzes a reference track's tonal balance,
loudness, and dynamics, then applies matching EQ + compression to the input.
"""
import numpy as np
import librosa
import soundfile as sf
from scipy.signal import butter, sosfilt
import subprocess
import os


def analyze_spectrum(audio: np.ndarray, sr: int, n_bands: int = 10) -> np.ndarray:
    """Get average energy per frequency band."""
    S = np.abs(librosa.stft(audio))
    freqs = librosa.fft_frequencies(sr=sr)

    band_edges = np.logspace(np.log10(20), np.log10(sr / 2), n_bands + 1)
    band_energy = np.zeros(n_bands)

    for i in range(n_bands):
        mask = (freqs >= band_edges[i]) & (freqs < band_edges[i + 1])
        if mask.any():
            band_energy[i] = np.mean(S[mask, :])

    return band_energy


def compute_loudness(audio: np.ndarray) -> float:
    """RMS loudness in dB."""
    rms = np.sqrt(np.mean(audio ** 2))
    return 20 * np.log10(max(rms, 1e-10))


def match_eq(input_path: str, reference_path: str, output_path: str, ffmpeg_path: str = "ffmpeg"):
    """Match the tonal balance of input to reference using FFmpeg EQ."""
    # Load both files
    input_audio, sr = librosa.load(input_path, sr=44100, mono=True)
    ref_audio, _ = librosa.load(reference_path, sr=44100, mono=True)

    # Analyze spectrums
    input_spectrum = analyze_spectrum(input_audio, sr)
    ref_spectrum = analyze_spectrum(ref_audio, sr)

    # Compute per-band gain differences (in dB)
    epsilon = 1e-10
    gain_db = 20 * np.log10((ref_spectrum + epsilon) / (input_spectrum + epsilon))
    gain_db = np.clip(gain_db, -12, 12)  # Limit to ±12dB

    # Build FFmpeg EQ filter chain
    band_centers = np.logspace(np.log10(30), np.log10(16000), len(gain_db))
    eq_filters = []
    for freq, gain in zip(band_centers, gain_db):
        if abs(gain) > 0.5:  # Only apply significant changes
            eq_filters.append(f"equalizer=f={freq:.0f}:width_type=o:width=1.5:g={gain:.1f}")

    # Loudness matching
    input_loud = compute_loudness(input_audio)
    ref_loud = compute_loudness(ref_audio)
    target_lufs = max(-14, min(-6, ref_loud + 5))  # Estimate LUFS from RMS

    filters = ",".join(eq_filters) if eq_filters else "anull"
    filters += f",loudnorm=I={target_lufs:.0f}:TP=-1:LRA=9,alimiter=limit=0.95"

    # Run FFmpeg
    cmd = [
        ffmpeg_path, "-y", "-i", input_path,
        "-af", filters,
        "-ar", "44100",
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed: {result.stderr[:500]}")

    return {
        "eq_bands_applied": len(eq_filters),
        "target_lufs": target_lufs,
        "gain_adjustments": gain_db.tolist(),
    }
