import os

from django.conf import settings
from django.core.cache import cache
from django.db import connections
from django.http import JsonResponse
from django.utils.timezone import now


def health_check(request):
    """
    Health check endpoint for monitoring system status.
    Returns 200 if all services are healthy, 503 if any service is down.
    """
    health = {
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
        if hasattr(settings, "CACHES") and settings.CACHES.get("default", {}).get(
            "BACKEND"
        ):
            cache.set("health_check_key", "test_value", 30)
            cached_value = cache.get("health_check_key")
            if cached_value == "test_value":
                health["checks"]["cache"] = {
                    "status": "healthy",
                    "message": "Cache is working properly",
                }
            else:
                health["checks"]["cache"] = {
                    "status": "unhealthy",
                    "message": "Cache test failed",
                }
        else:
            health["checks"]["cache"] = {
                "status": "not_configured",
                "message": "Cache not configured",
            }
    except Exception as e:
        health["checks"]["cache"] = {
            "status": "unhealthy",
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
    # Disk space check (optional)
    try:
        import shutil

        total, used, free = shutil.disk_usage("/")
        free_percentage = (free / total) * 100
        if free_percentage < 10:  # Less than 10% free space
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
        check for check in health["checks"].values() if check["status"] == "unhealthy"
    ]
    if unhealthy_checks:
        health["status"] = "unhealthy"
    # Return appropriate HTTP status code
    status_code = 200 if health["status"] == "healthy" else 503
    return JsonResponse(health, status=status_code)


def ready_check(request):
    """
    Readiness check - indicates if the application is ready to serve traffic.
    More lightweight than health check.
    """
    try:
        # Just check database connectivity
        db_conn = connections["default"]
        with db_conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            return JsonResponse({"status": "ready", "timestamp": now().isoformat()})
    except Exception as e:
        return JsonResponse(
            {"status": "not_ready", "error": str(e), "timestamp": now().isoformat()},
            status=503,
        )


def live_check(request):
    """
    Liveness check - indicates if the application is running.
    Most basic check.
    """
    return JsonResponse({"status": "alive", "timestamp": now().isoformat()})
