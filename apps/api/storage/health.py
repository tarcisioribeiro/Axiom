import os

from django.conf import settings

from app.config import cfg


def check_storage() -> dict[str, str]:
    """
    Lightweight MinIO/S3 connectivity check.
    Uses a HEAD bucket request with a 2-second timeout.
    Returns not_configured when MINIO_ENDPOINT is not set.
    """
    minio_endpoint = cfg("MINIO_ENDPOINT") or getattr(
        settings, "MINIO_ENDPOINT", ""
    )
    if not minio_endpoint:
        return {
            "status": "not_configured",
            "message": "Storage not configured",
        }

    try:
        import boto3
        from botocore.config import Config
        from botocore.exceptions import EndpointConnectionError
    except ImportError:
        return {"status": "unknown", "message": "boto3 not available"}

    try:
        use_ssl = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
        protocol = "https" if use_ssl else "http"
        endpoint_url = f"{protocol}://{minio_endpoint}"
        bucket_name = cfg("MINIO_BUCKET_NAME") or getattr(
            settings, "AWS_STORAGE_BUCKET_NAME", "axiom"
        )
        verify = getattr(
            settings, "AWS_S3_VERIFY", os.getenv("MINIO_CA_BUNDLE", True)
        )
        client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=cfg("MINIO_ROOT_USER")
            or getattr(settings, "AWS_ACCESS_KEY_ID", None),
            aws_secret_access_key=cfg("MINIO_ROOT_PASSWORD")
            or getattr(settings, "AWS_SECRET_ACCESS_KEY", None),
            region_name=getattr(settings, "AWS_S3_REGION_NAME", "us-east-1"),
            verify=verify,
            config=Config(
                connect_timeout=2,
                read_timeout=2,
                retries={"max_attempts": 0},
            ),
        )
        client.head_bucket(Bucket=bucket_name)
        return {
            "status": "healthy",
            "message": "Storage connection successful",
            "message_key": "storage_successful",
        }
    except EndpointConnectionError:
        return {
            "status": "degraded",
            "message": "Storage endpoint unreachable",
            "message_key": "storage_unreachable",
        }
    except Exception as e:
        return {"status": "degraded", "message": f"Storage error: {str(e)}"}
