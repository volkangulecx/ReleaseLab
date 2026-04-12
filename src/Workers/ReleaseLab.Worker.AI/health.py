"""Health/metrics endpoint for AI Worker."""
from fastapi import FastAPI
from app.genre_presets import list_presets

app = FastAPI(title="ReleaseLab AI Worker")


@app.get("/health")
def health():
    return {"status": "healthy", "worker": "ai"}


@app.get("/presets")
def presets():
    return list_presets()
