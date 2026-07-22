import os
import time
from datetime import datetime, timezone
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.db import connections
from django.http import HttpRequest, JsonResponse
from django.utils.timezone import now

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


def health_check(request: HttpRequest) -> JsonResponse:
    """
    Health check endpoint for monitoring system status.
    Returns 200 if all services are healthy, 503 if any service is down.
    """
    health: dict[str, Any] = {
        "status": "healthy",
        "timestamp": now().isoformat(),
        "version": "1.0.0",
        "checks": {},
    }
    # Database connectivity check
    try:
        db_conn = connections["default"]
        with db_conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        health["checks"]["database"] = {
            "status": "healthy",
            "message": "Database connection successful",
        }
    except Exception as e:
        health["checks"]["database"] = {
            "status": "unhealthy",
            "message": f"Database connection failed: {str(e)}",
        }
        health["status"] = "unhealthy"
    # Cache check (if Redis is configured)
    try:
        if hasattr(settings, "CACHES") and settings.CACHES.get(
            "default", {}
        ).get("BACKEND"):
            cache.set("health_check_key", "test_value", 30)
            cached_value = cache.get("health_check_key")
            if cached_value == "test_value":
                health["checks"]["cache"] = {
                    "status": "healthy",
                    "message": "Cache is working properly",
                }
            else:
                health["checks"]["cache"] = {
                    "status": "degraded",
                    "message": "Cache test failed",
                }
        else:
            health["checks"]["cache"] = {
                "status": "not_configured",
                "message": "Cache not configured",
            }
    except Exception as e:
        health["checks"]["cache"] = {
            "status": "degraded",
            "message": f"Cache error: {str(e)}",
        }
    # Environment variables check
    required_env_vars = ["SECRET_KEY", "ENCRYPTION_KEY", "DB_NAME", "DB_USER"]
    missing_vars = []
    for var in required_env_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    if missing_vars:
        health["checks"]["environment"] = {
            "status": "unhealthy",
            "message": (
                f"Missing environment variables: " f'{", ".join(missing_vars)}'
            ),
        }
        health["status"] = "unhealthy"
    else:
        health["checks"]["environment"] = {
            "status": "healthy",
            "message": "All required environment variables are set",
        }
    # Storage (MinIO) check — non-critical: degraded state does not cause 503
    storage_result = check_storage()
    health["checks"]["storage"] = storage_result
    # Disk space check (optional)
    try:
        import shutil

        total, used, free = shutil.disk_usage("/")
        free_percentage = (free / total) * 100
        threshold = getattr(settings, "DISK_SPACE_WARN_THRESHOLD", 10)
        if free_percentage < threshold:
            health["checks"]["disk_space"] = {
                "status": "warning",
                "message": f"Low disk space: {free_percentage:.1f}% free",
            }
        else:
            health["checks"]["disk_space"] = {
                "status": "healthy",
                "message": f"Disk space OK: {free_percentage:.1f}% free",
            }
    except Exception as e:
        health["checks"]["disk_space"] = {
            "status": "unknown",
            "message": f"Could not check disk space: {str(e)}",
        }
    # Determine overall status
    unhealthy_checks = [
        check
        for check in health["checks"].values()
        if check["status"] == "unhealthy"
    ]
    if unhealthy_checks:
        health["status"] = "unhealthy"
    # Return appropriate HTTP status code
    status_code = 200 if health["status"] == "healthy" else 503
    return JsonResponse(health, status=status_code)


def ready_check(request: HttpRequest) -> JsonResponse:
    """
    Readiness check - indicates if the application is ready to serve traffic.
    More lightweight than health check.
    """
    try:
        # Just check database connectivity
        db_conn = connections["default"]
        with db_conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            return JsonResponse(
                {"status": "ready", "timestamp": now().isoformat()}
            )
    except Exception as e:
        return JsonResponse(
            {
                "status": "not_ready",
                "error": str(e),
                "timestamp": now().isoformat(),
            },
            status=503,
        )


def live_check(request: HttpRequest) -> JsonResponse:
    """
    Liveness check - indicates if the application is running.
    Most basic check.
    """
    return JsonResponse({"status": "alive", "timestamp": now().isoformat()})


def backup_health_check(request: HttpRequest) -> JsonResponse:
    """
    Backup staleness check.

    Reads the sentinel files written by api/scripts/backup.sh and returns:
      200  {"status": "ok",    "last_backup": "<ISO8601>"}
           — backup within window
      503  {"status": "error", "message": "..."}
           — stale, failed, or missing

    The staleness threshold defaults to 26 h (daily schedule + 2 h grace) and
    can be overridden via the BACKUP_MAX_AGE_HOURS Django setting.
    """
    backup_dir = os.environ.get("BACKUP_DIR", "/backups")
    max_age_hours: float = getattr(settings, "BACKUP_MAX_AGE_HOURS", 26.0)
    max_age_seconds = max_age_hours * 3600

    sentinel = os.path.join(backup_dir, ".last_successful_backup")
    status_file = os.path.join(backup_dir, ".last_backup_status")

    if not os.path.exists(sentinel):
        return JsonResponse(
            {
                "status": "error",
                "message": (
                    "No backup sentinel found. "
                    "The backup service may not have run yet."
                ),
            },
            status=503,
        )

    try:
        with open(sentinel) as fh:
            last_ts = float(fh.read().strip())
    except (ValueError, OSError) as exc:
        return JsonResponse(
            {
                "status": "error",
                "message": f"Cannot read backup sentinel: {exc}",
            },
            status=503,
        )

    last_status = ""
    if os.path.exists(status_file):
        try:
            with open(status_file) as fh:
                last_status = fh.read().strip()
        except OSError:
            pass

    if last_status.startswith("failed:"):
        return JsonResponse(
            {
                "status": "error",
                "message": f"Last backup failed: {last_status}",
            },
            status=503,
        )

    age_seconds = time.time() - last_ts
    last_backup_iso = datetime.fromtimestamp(
        last_ts, tz=timezone.utc
    ).isoformat()

    if age_seconds > max_age_seconds:
        age_hours = age_seconds / 3600
        return JsonResponse(
            {
                "status": "error",
                "message": (
                    f"Last backup is {age_hours:.1f}h old "
                    f"(threshold: {max_age_hours}h)."
                ),
                "last_backup": last_backup_iso,
            },
            status=503,
        )

    return JsonResponse({"status": "ok", "last_backup": last_backup_iso})
