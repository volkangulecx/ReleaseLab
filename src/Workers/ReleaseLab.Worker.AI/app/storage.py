import os
from minio import Minio
from . import config

_client = None

def get_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            config.S3_ENDPOINT,
            access_key=config.S3_ACCESS_KEY,
            secret_key=config.S3_SECRET_KEY,
            secure=config.S3_SECURE,
        )
    return _client

def download(bucket: str, key: str, local_path: str) -> str:
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    get_client().fget_object(bucket, key, local_path)
    return local_path

def upload(bucket: str, key: str, local_path: str, content_type: str = "audio/wav"):
    client = get_client()
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    client.fput_object(bucket, key, local_path, content_type=content_type)
