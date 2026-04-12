"""
Stem Separation using Demucs — splits audio into vocals, drums, bass, other.
"""
import os
import subprocess
import shutil


def separate_stems(
    input_path: str,
    output_dir: str,
    model: str = "htdemucs",
    device: str = "cpu",
) -> dict[str, str]:
    """
    Separate audio into stems using Demucs.

    Returns dict mapping stem name to file path:
    {"vocals": "/path/vocals.wav", "drums": "/path/drums.wav", ...}
    """
    os.makedirs(output_dir, exist_ok=True)

    cmd = [
        "python", "-m", "demucs",
        "--name", model,
        "--out", output_dir,
        "--device", device,
        "--two-stems" if model == "htdemucs" else None,
        input_path,
    ]
    # Remove None entries
    cmd = [c for c in cmd if c is not None]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"Demucs failed: {result.stderr[:500]}")

    # Find output files
    track_name = os.path.splitext(os.path.basename(input_path))[0]
    stems_dir = os.path.join(output_dir, model, track_name)

    stems = {}
    for stem_file in os.listdir(stems_dir):
        if stem_file.endswith(".wav"):
            stem_name = os.path.splitext(stem_file)[0]
            stems[stem_name] = os.path.join(stems_dir, stem_file)

    return stems


def separate_vocals(input_path: str, output_dir: str, device: str = "cpu") -> tuple[str, str]:
    """Quick vocal isolation — returns (vocals_path, instrumental_path)."""
    stems = separate_stems(input_path, output_dir, model="htdemucs", device=device)
    return stems.get("vocals", ""), stems.get("no_vocals", stems.get("other", ""))
