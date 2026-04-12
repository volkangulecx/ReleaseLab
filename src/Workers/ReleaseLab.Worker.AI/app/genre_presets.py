"""
Advanced genre-specific mastering presets.
Each preset defines FFmpeg filter chain parameters optimized for the genre.
"""

GENRE_PRESETS = {
    "hiphop": {
        "name": "Hip-Hop",
        "description": "Heavy low-end, punchy drums, vocal presence",
        "filters": (
            "highpass=f=25,"
            "equalizer=f=60:width_type=o:width=1.5:g=3,"
            "equalizer=f=100:width_type=o:width=2:g=2,"
            "equalizer=f=3000:width_type=o:width=2:g=1.5,"
            "equalizer=f=8000:width_type=o:width=2:g=1,"
            "acompressor=threshold=-15dB:ratio=4:attack=5:release=150,"
            "extrastereo=m=1.2,"
            "loudnorm=I=-9:TP=-1:LRA=7,"
            "alimiter=limit=0.95"
        ),
        "target_lufs": -9,
    },
    "edm": {
        "name": "EDM / Electronic",
        "description": "Wide stereo, powerful subs, crisp highs",
        "filters": (
            "highpass=f=20,"
            "equalizer=f=50:width_type=o:width=1:g=3,"
            "equalizer=f=200:width_type=o:width=2:g=-1,"
            "equalizer=f=5000:width_type=o:width=2:g=2,"
            "equalizer=f=12000:width_type=o:width=2:g=1.5,"
            "acompressor=threshold=-12dB:ratio=3.5:attack=3:release=100,"
            "extrastereo=m=1.8,"
            "loudnorm=I=-8:TP=-0.5:LRA=6,"
            "alimiter=limit=0.98"
        ),
        "target_lufs": -8,
    },
    "jazz": {
        "name": "Jazz",
        "description": "Natural dynamics, warm mids, open soundstage",
        "filters": (
            "highpass=f=35,"
            "equalizer=f=200:width_type=o:width=2:g=1,"
            "equalizer=f=800:width_type=o:width=2:g=0.5,"
            "equalizer=f=3000:width_type=o:width=2:g=-0.5,"
            "acompressor=threshold=-24dB:ratio=1.5:attack=30:release=400,"
            "extrastereo=m=1.3,"
            "loudnorm=I=-16:TP=-1:LRA=14,"
            "alimiter=limit=0.93"
        ),
        "target_lufs": -16,
    },
    "classical": {
        "name": "Classical",
        "description": "Maximum dynamic range, pristine clarity",
        "filters": (
            "highpass=f=30,"
            "equalizer=f=250:width_type=o:width=2:g=0.3,"
            "equalizer=f=4000:width_type=o:width=2:g=0.5,"
            "acompressor=threshold=-28dB:ratio=1.2:attack=50:release=500,"
            "extrastereo=m=1.1,"
            "loudnorm=I=-18:TP=-1:LRA=16,"
            "alimiter=limit=0.92"
        ),
        "target_lufs": -18,
    },
    "pop": {
        "name": "Pop",
        "description": "Radio-ready, vocal-forward, balanced",
        "filters": (
            "highpass=f=30,"
            "equalizer=f=150:width_type=o:width=2:g=1,"
            "equalizer=f=2500:width_type=o:width=2:g=2,"
            "equalizer=f=6000:width_type=o:width=2:g=1.5,"
            "equalizer=f=10000:width_type=o:width=2:g=1,"
            "acompressor=threshold=-16dB:ratio=3:attack=8:release=180,"
            "extrastereo=m=1.4,"
            "loudnorm=I=-11:TP=-1:LRA=8,"
            "alimiter=limit=0.95"
        ),
        "target_lufs": -11,
    },
    "rock": {
        "name": "Rock",
        "description": "Aggressive midrange, tight low-end, energy",
        "filters": (
            "highpass=f=30,"
            "equalizer=f=80:width_type=o:width=2:g=2,"
            "equalizer=f=500:width_type=o:width=2:g=1,"
            "equalizer=f=2000:width_type=o:width=2:g=1.5,"
            "equalizer=f=8000:width_type=o:width=2:g=1,"
            "acompressor=threshold=-14dB:ratio=3.5:attack=5:release=150,"
            "extrastereo=m=1.3,"
            "loudnorm=I=-10:TP=-1:LRA=7,"
            "alimiter=limit=0.95"
        ),
        "target_lufs": -10,
    },
}


def get_preset(name: str) -> dict | None:
    return GENRE_PRESETS.get(name.lower())


def list_presets() -> list[dict]:
    return [
        {"id": k, "name": v["name"], "description": v["description"], "targetLufs": v["target_lufs"]}
        for k, v in GENRE_PRESETS.items()
    ]
