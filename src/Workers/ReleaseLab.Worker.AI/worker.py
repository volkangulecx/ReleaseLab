"""
ReleaseLab AI Worker — consumes jobs from Redis queues:
- queue:mastering:ai    → AI-powered mastering with reference matching
- queue:stems           → Stem separation (vocals/drums/bass/other)
"""
import json
import os
import sys
import time
import logging
import redis

from app import config
from app.storage import download, upload
from app.reference_match import match_eq
from app.stem_separation import separate_stems
from app.genre_presets import get_preset

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s %(message)s")
log = logging.getLogger("ai-worker")

r = redis.Redis.from_url(config.REDIS_URL, decode_responses=True)


def publish_progress(job_id: str, progress: int, stage: str):
    r.publish(f"events:job:{job_id}:progress", json.dumps({
        "JobId": job_id,
        "Progress": progress,
        "Stage": stage,
    }))


def process_ai_mastering(msg: dict):
    job_id = msg["JobId"]
    input_key = msg["InputS3Key"]
    output_bucket = msg["OutputBucket"]
    user_id = msg["UserId"]
    preset = msg.get("Preset", "pop")
    reference_key = msg.get("ReferenceS3Key")

    temp_dir = os.path.join(config.TEMP_DIR, job_id)
    os.makedirs(temp_dir, exist_ok=True)
    input_path = os.path.join(temp_dir, "input.wav")
    output_wav = os.path.join(temp_dir, "master.wav")
    output_mp3 = os.path.join(temp_dir, "preview.mp3")

    try:
        # Download input
        publish_progress(job_id, 10, "downloading")
        download(config.RAW_BUCKET, input_key, input_path)

        if reference_key:
            # Reference track matching
            publish_progress(job_id, 30, "analyzing-reference")
            ref_path = os.path.join(temp_dir, "reference.wav")
            download(config.RAW_BUCKET, reference_key, ref_path)

            publish_progress(job_id, 50, "matching-eq")
            result = match_eq(input_path, ref_path, output_wav)
            log.info(f"Reference match applied: {result['eq_bands_applied']} bands adjusted")
        else:
            # Genre preset mastering
            publish_progress(job_id, 30, "applying-preset")
            genre = get_preset(preset)
            if genre is None:
                raise ValueError(f"Unknown preset: {preset}")

            import subprocess
            cmd = [
                "ffmpeg", "-y", "-i", input_path,
                "-af", genre["filters"],
                "-ar", "44100", output_wav
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg failed: {result.stderr[:500]}")

        # Create preview MP3
        publish_progress(job_id, 70, "encoding-preview")
        import subprocess
        subprocess.run([
            "ffmpeg", "-y", "-i", output_wav,
            "-ar", "44100", "-b:a", "128k", output_mp3
        ], capture_output=True, timeout=120)

        # Upload results
        publish_progress(job_id, 85, "uploading")
        upload(output_bucket, f"{user_id}/{job_id}/master.wav", output_wav)
        upload(output_bucket, f"{user_id}/{job_id}/preview.mp3", output_mp3, "audio/mpeg")

        publish_progress(job_id, 100, "completed")
        r.publish("events:job:completed", json.dumps({
            "JobId": job_id,
            "OutputS3Key": f"{user_id}/{job_id}/master.wav",
        }))
        log.info(f"AI mastering completed: {job_id}")

    except Exception as e:
        log.error(f"AI mastering failed for {job_id}: {e}")
        r.publish("events:job:failed", json.dumps({
            "JobId": job_id,
            "ErrorCode": "AI_PROCESSING_ERROR",
            "ErrorMessage": str(e)[:500],
        }))
    finally:
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)


def process_stem_separation(msg: dict):
    job_id = msg["JobId"]
    input_key = msg["InputS3Key"]
    output_bucket = msg["OutputBucket"]
    user_id = msg["UserId"]

    temp_dir = os.path.join(config.TEMP_DIR, f"stems-{job_id}")
    os.makedirs(temp_dir, exist_ok=True)
    input_path = os.path.join(temp_dir, "input.wav")

    try:
        publish_progress(job_id, 10, "downloading")
        download(config.RAW_BUCKET, input_key, input_path)

        publish_progress(job_id, 20, "separating-stems")
        stems = separate_stems(input_path, temp_dir)

        publish_progress(job_id, 80, "uploading-stems")
        stem_keys = {}
        for stem_name, stem_path in stems.items():
            s3_key = f"{user_id}/{job_id}/stems/{stem_name}.wav"
            upload(output_bucket, s3_key, stem_path)
            stem_keys[stem_name] = s3_key

        publish_progress(job_id, 100, "completed")
        r.publish("events:job:completed", json.dumps({
            "JobId": job_id,
            "OutputS3Key": json.dumps(stem_keys),
        }))
        log.info(f"Stem separation completed: {job_id} → {list(stems.keys())}")

    except Exception as e:
        log.error(f"Stem separation failed for {job_id}: {e}")
        r.publish("events:job:failed", json.dumps({
            "JobId": job_id,
            "ErrorCode": "STEM_SEPARATION_ERROR",
            "ErrorMessage": str(e)[:500],
        }))
    finally:
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)


def main():
    log.info("AI Worker started — listening on queues: mastering:ai, stems")

    while True:
        try:
            # BRPOP with 5s timeout — check both queues
            result = r.brpop([config.QUEUE_AI, config.QUEUE_STEMS], timeout=5)
            if result is None:
                continue

            queue, raw = result
            msg = json.loads(raw)
            log.info(f"Received job from {queue}: {msg.get('JobId', 'unknown')}")

            if queue == config.QUEUE_AI:
                process_ai_mastering(msg)
            elif queue == config.QUEUE_STEMS:
                process_stem_separation(msg)

        except KeyboardInterrupt:
            log.info("Shutting down")
            break
        except Exception as e:
            log.error(f"Worker error: {e}")
            time.sleep(5)


if __name__ == "__main__":
    main()
