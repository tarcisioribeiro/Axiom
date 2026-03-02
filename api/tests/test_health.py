from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from django.urls import reverse


class HealthCheckViewTest(TestCase):
    """Tests for the /health/ endpoint."""

    def test_health_check_returns_200_when_all_healthy(self):
        url = reverse("health-check")
        with patch(
            "app.health.check_storage",
            return_value={"status": "healthy", "message": "ok"},
        ):
            response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_health_check_returns_503_when_db_down(self):
        url = reverse("health-check")
        with patch(
            "app.health.check_storage",
            return_value={"status": "not_configured", "message": "not configured"},
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
        self.assertEqual(response.json()["checks"]["storage"]["status"], "unhealthy")


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
            AWS_STORAGE_BUCKET_NAME="mindledger",
            AWS_S3_REGION_NAME="us-east-1",
        ):
            with patch("boto3.client", return_value=mock_client):
                result = check_storage()

        self.assertEqual(result["status"], "healthy")
        mock_client.head_bucket.assert_called_once_with(Bucket="mindledger")

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
            AWS_STORAGE_BUCKET_NAME="mindledger",
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
            AWS_STORAGE_BUCKET_NAME="mindledger",
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
            AWS_STORAGE_BUCKET_NAME="mindledger",
            AWS_S3_REGION_NAME="us-east-1",
        ):
            with patch("boto3.client", return_value=mock_client) as mock_boto3:
                check_storage()

        call_kwargs = mock_boto3.call_args.kwargs
        cfg: Config = call_kwargs["config"]
        self.assertEqual(cfg.connect_timeout, 2)
        self.assertEqual(cfg.read_timeout, 2)
        self.assertEqual(cfg.retries["max_attempts"], 0)


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
        self.assertEqual(response.json()["checks"]["disk_space"]["status"], "warning")

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
        self.assertEqual(response.json()["checks"]["disk_space"]["status"], "healthy")
