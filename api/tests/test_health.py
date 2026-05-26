import time
from unittest.mock import MagicMock, mock_open, patch

from django.test import TestCase, override_settings
from django.urls import reverse


class HealthCheckViewTest(TestCase):
    """Tests for the /health/ endpoint."""

    def test_health_check_returns_200_when_all_healthy(self):
        url = reverse("health-check")
        # Switch to in-memory cache so the set/get round-trip succeeds
        # without Redis.
        locmem_caches = {
            "default": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                "LOCATION": "test-health",
            }
        }
        with patch(
            "app.health.check_storage",
            return_value={"status": "healthy", "message": "ok"},
        ):
            with override_settings(CACHES=locmem_caches):
                response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_health_check_returns_503_when_db_down(self):
        url = reverse("health-check")
        with patch(
            "app.health.check_storage",
            return_value={
                "status": "not_configured",
                "message": "not configured",
            },
        ):
            with patch(
                "django.db.backends.base.base.BaseDatabaseWrapper.cursor",
                side_effect=Exception("DB down"),
            ):
                response = self.client.get(url)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "unhealthy")

    def test_health_check_includes_storage_key(self):
        url = reverse("health-check")
        storage_result = {
            "status": "not_configured",
            "message": "Storage not configured",
        }
        with patch("app.health.check_storage", return_value=storage_result):
            response = self.client.get(url)
        data = response.json()
        self.assertIn("storage", data["checks"])

    def test_health_check_unhealthy_when_storage_unhealthy(self):
        url = reverse("health-check")
        storage_result = {
            "status": "unhealthy",
            "message": "Storage endpoint unreachable",
        }
        with patch("app.health.check_storage", return_value=storage_result):
            response = self.client.get(url)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json()["checks"]["storage"]["status"], "unhealthy"
        )


class CheckStorageTest(TestCase):
    """Unit tests for check_storage()."""

    from app.health import check_storage

    def test_not_configured_when_no_endpoint(self):
        from app.health import check_storage

        with override_settings(MINIO_ENDPOINT=""):
            with patch.dict("os.environ", {"MINIO_ENDPOINT": ""}, clear=False):
                result = check_storage()
        self.assertEqual(result["status"], "not_configured")

    def test_healthy_when_head_bucket_succeeds(self):
        from app.health import check_storage

        mock_client = MagicMock()
        mock_client.head_bucket.return_value = {}

        with override_settings(
            MINIO_ENDPOINT="minio:9000",
            AWS_ACCESS_KEY_ID="key",
            AWS_SECRET_ACCESS_KEY="secret",
            AWS_STORAGE_BUCKET_NAME="axiom",
            AWS_S3_REGION_NAME="us-east-1",
        ):
            with patch("boto3.client", return_value=mock_client):
                result = check_storage()

        self.assertEqual(result["status"], "healthy")
        mock_client.head_bucket.assert_called_once_with(Bucket="axiom")

    def test_unhealthy_on_endpoint_connection_error(self):
        from botocore.exceptions import EndpointConnectionError

        from app.health import check_storage

        mock_client = MagicMock()
        mock_client.head_bucket.side_effect = EndpointConnectionError(
            endpoint_url="http://minio:9000"
        )

        with override_settings(
            MINIO_ENDPOINT="minio:9000",
            AWS_ACCESS_KEY_ID="key",
            AWS_SECRET_ACCESS_KEY="secret",
            AWS_STORAGE_BUCKET_NAME="axiom",
            AWS_S3_REGION_NAME="us-east-1",
        ):
            with patch("boto3.client", return_value=mock_client):
                result = check_storage()

        self.assertEqual(result["status"], "unhealthy")
        self.assertIn("unreachable", result["message"])

    def test_unhealthy_on_generic_exception(self):
        from app.health import check_storage

        mock_client = MagicMock()
        mock_client.head_bucket.side_effect = Exception("connection refused")

        with override_settings(
            MINIO_ENDPOINT="minio:9000",
            AWS_ACCESS_KEY_ID="key",
            AWS_SECRET_ACCESS_KEY="secret",
            AWS_STORAGE_BUCKET_NAME="axiom",
            AWS_S3_REGION_NAME="us-east-1",
        ):
            with patch("boto3.client", return_value=mock_client):
                result = check_storage()

        self.assertEqual(result["status"], "unhealthy")
        self.assertIn("connection refused", result["message"])

    def test_boto3_client_called_with_correct_timeout(self):
        from botocore.config import Config

        from app.health import check_storage

        mock_client = MagicMock()
        mock_client.head_bucket.return_value = {}

        with override_settings(
            MINIO_ENDPOINT="minio:9000",
            AWS_ACCESS_KEY_ID="key",
            AWS_SECRET_ACCESS_KEY="secret",
            AWS_STORAGE_BUCKET_NAME="axiom",
            AWS_S3_REGION_NAME="us-east-1",
        ):
            with patch("boto3.client", return_value=mock_client) as mock_boto3:
                check_storage()

        call_kwargs = mock_boto3.call_args.kwargs
        cfg: Config = call_kwargs["config"]
        self.assertEqual(cfg.connect_timeout, 2)
        self.assertEqual(cfg.read_timeout, 2)
        self.assertEqual(cfg.retries["max_attempts"], 0)


class BackupHealthCheckTest(TestCase):
    """Tests for the /api/v1/health/backup/ endpoint."""

    url = "/api/v1/health/backup/"

    def _sentinel_exists(self, exists: bool, ts: float = 0.0) -> dict:
        """Return patch kwargs for os.path.exists and open."""
        return {"exists": exists, "ts": ts}

    def test_returns_503_when_sentinel_missing(self):
        with patch("os.path.exists", return_value=False):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "error")
        self.assertIn("sentinel", response.json()["message"])

    def test_returns_503_when_sentinel_unreadable(self):
        with patch("os.path.exists", return_value=True):
            with patch(
                "builtins.open", side_effect=OSError("permission denied")
            ):
                response = self.client.get(self.url)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "error")

    def test_returns_503_when_sentinel_contains_invalid_data(self):
        with patch("os.path.exists", return_value=True):
            with patch(
                "builtins.open", mock_open(read_data="not-a-timestamp")
            ):
                response = self.client.get(self.url)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "error")

    def test_returns_503_when_last_status_is_failed(self):
        recent_ts = str(time.time())

        def fake_open(path, *args, **kwargs):
            if "status" in path:
                return mock_open(read_data="failed: upload error")()
            return mock_open(read_data=recent_ts)()

        with patch("os.path.exists", return_value=True):
            with patch("builtins.open", side_effect=fake_open):
                response = self.client.get(self.url)
        self.assertEqual(response.status_code, 503)
        data = response.json()
        self.assertEqual(data["status"], "error")
        self.assertIn("failed", data["message"])

    def test_returns_503_when_backup_is_stale(self):
        stale_ts = str(time.time() - 30 * 3600)  # 30 hours ago

        def fake_open(path, *args, **kwargs):
            if "status" in path:
                return mock_open(read_data="success:axiom_20240101.sql.enc")()
            return mock_open(read_data=stale_ts)()

        with patch("os.path.exists", return_value=True):
            with patch("builtins.open", side_effect=fake_open):
                response = self.client.get(self.url)
        self.assertEqual(response.status_code, 503)
        data = response.json()
        self.assertEqual(data["status"], "error")
        self.assertIn("last_backup", data)

    def test_returns_200_when_backup_is_fresh(self):
        recent_ts = str(time.time() - 3600)  # 1 hour ago

        def fake_open(path, *args, **kwargs):
            if "status" in path:
                return mock_open(read_data="success:axiom_20240101.sql.enc")()
            return mock_open(read_data=recent_ts)()

        with patch("os.path.exists", return_value=True):
            with patch("builtins.open", side_effect=fake_open):
                response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("last_backup", data)
        # Verify ISO8601 format (ends with +00:00)
        self.assertIn("+00:00", data["last_backup"])

    def test_custom_max_age_hours_via_setting(self):
        """BACKUP_MAX_AGE_HOURS=2 should flag a 3-hour-old backup as stale."""
        ts_3h_ago = str(time.time() - 3 * 3600)

        def fake_open(path, *args, **kwargs):
            if "status" in path:
                return mock_open(read_data="success:backup.enc")()
            return mock_open(read_data=ts_3h_ago)()

        with patch("os.path.exists", return_value=True):
            with patch("builtins.open", side_effect=fake_open):
                with override_settings(BACKUP_MAX_AGE_HOURS=2):
                    response = self.client.get(self.url)
        self.assertEqual(response.status_code, 503)

    def test_returns_200_when_status_file_missing_but_sentinel_fresh(self):
        """No .last_backup_status file should not block a healthy response."""
        recent_ts = str(time.time() - 600)  # 10 minutes ago

        def fake_exists(path: str) -> bool:
            return "status" not in path

        def fake_open(path, *args, **kwargs):
            return mock_open(read_data=recent_ts)()

        with patch("os.path.exists", side_effect=fake_exists):
            with patch("builtins.open", side_effect=fake_open):
                response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")


class DiskSpaceThresholdTest(TestCase):
    """Tests for configurable DISK_SPACE_WARN_THRESHOLD."""

    def test_warning_when_below_custom_threshold(self):
        """A threshold of 90 should produce a warning when 85% is free."""
        url = reverse("health-check")
        # disk_usage returns (total, used, free); free/total = 0.85
        mock_usage = (100, 15, 85)
        with patch(
            "app.health.check_storage",
            return_value={"status": "not_configured", "message": ""},
        ):
            with override_settings(DISK_SPACE_WARN_THRESHOLD=90):
                with patch("shutil.disk_usage", return_value=mock_usage):
                    response = self.client.get(url)
        self.assertEqual(
            response.json()["checks"]["disk_space"]["status"], "warning"
        )

    def test_healthy_disk_when_above_threshold(self):
        """Default 10% threshold — 50% free is healthy."""
        url = reverse("health-check")
        mock_usage = (100, 50, 50)
        with patch(
            "app.health.check_storage",
            return_value={"status": "not_configured", "message": ""},
        ):
            with override_settings(DISK_SPACE_WARN_THRESHOLD=10):
                with patch("shutil.disk_usage", return_value=mock_usage):
                    response = self.client.get(url)
        self.assertEqual(
            response.json()["checks"]["disk_space"]["status"], "healthy"
        )
