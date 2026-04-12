import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_SECURE = os.getenv("S3_SECURE", "false").lower() == "true"

RAW_BUCKET = "releaselab-raw"
PROCESSED_BUCKET = "releaselab-processed"
TEMP_DIR = os.getenv("TEMP_DIR", "/tmp/releaselab-ai")

QUEUE_AI = "queue:mastering:ai"
QUEUE_STEMS = "queue:stems"
