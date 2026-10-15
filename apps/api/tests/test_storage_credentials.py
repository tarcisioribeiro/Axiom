"""
Regression: MinIO credentials must come from settings (.env), never from
SystemConfig. A DB dump restored from another environment carries that
environment's MINIO_ROOT_USER/PASSWORD and used to make every storage
request fail with 403.
"""

from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings

from admin_panel.models import SystemConfig

ENV_SETTINGS = {
    "MINIO_ENDPOINT": "minio:9000",
    "AWS_S3_ENDPOINT_URL": "http://minio:9000",
    "AWS_ACCESS_KEY_ID": "env-user",
    "AWS_SECRET_ACCESS_KEY": "env-pass",
    "AWS_STORAGE_BUCKET_NAME": "axiom",
}


class StorageIgnoresSystemConfigTest(TestCase):
    def setUp(self) -> None:
        for key, value in {
            "MINIO_ENDPOINT": "minio.other-env.example",
            "MINIO_BUCKET_NAME": "other-bucket",
            "MINIO_ROOT_USER": "other-user",
            "MINIO_ROOT_PASSWORD": "other-pass",
        }.items():
            obj, _ = SystemConfig.objects.get_or_create(
                key=key, defaults={"category": "storage", "label": key}
            )
            obj.set_value(value)
            obj.save()

    @override_settings(**ENV_SETTINGS)
    def test_backend_uses_settings_credentials(self) -> None:
        from storage.backends import MinIOStorage

        with (
            patch.dict(
                "os.environ", {"MINIO_EXTERNAL_ENDPOINT": "localhost:39105"}
            ),
            patch("storage.backends.boto3.client") as client,
        ):
            storage = MinIOStorage()

        self.assertEqual(storage.access_key, "env-user")
        self.assertEqual(storage.secret_key, "env-pass")
        kwargs = client.call_args.kwargs
        self.assertEqual(kwargs["aws_access_key_id"], "env-user")
        self.assertEqual(kwargs["aws_secret_access_key"], "env-pass")

    @override_settings(**ENV_SETTINGS)
    def test_health_check_uses_settings_credentials(self) -> None:
        from storage.health import check_storage

        with patch("boto3.client", return_value=MagicMock()) as client:
            check_storage()

        kwargs = client.call_args.kwargs
        self.assertEqual(kwargs["endpoint_url"], "http://minio:9000")
        self.assertEqual(kwargs["aws_access_key_id"], "env-user")
        self.assertEqual(kwargs["aws_secret_access_key"], "env-pass")
        client.return_value.head_bucket.assert_called_once_with(Bucket="axiom")
