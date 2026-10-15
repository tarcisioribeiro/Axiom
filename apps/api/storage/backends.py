import os
from typing import Any, Optional

import boto3
from botocore.config import Config
from storages.backends.s3boto3 import S3Boto3Storage


class MinIOStorage(S3Boto3Storage):
    """
    Custom S3Boto3Storage for MinIO.

    Uses the internal endpoint (minio:9000) for uploads/operations,
    but generates presigned URLs signed with the external endpoint
    (localhost:39105) so the browser can access files directly.

    Credentials come only from Django settings (i.e. the .env the MinIO
    server itself uses), never from SystemConfig: a DB dump restored from
    another environment carries that environment's credentials and would
    make every request fail with 403.

    Presigned URLs must be signed with the same host the browser will use,
    otherwise MinIO rejects the request because the Host header won't match
    the value baked into the SigV4 signature.
    """

    def __init__(self, **settings: Any) -> None:
        super().__init__(**settings)

        self.external_endpoint = os.getenv("MINIO_EXTERNAL_ENDPOINT", "")
        self.use_ssl = os.getenv("MINIO_USE_SSL", "false").lower() == "true"

        if self.external_endpoint:
            protocol = "https" if self.use_ssl else "http"
            verify: Any = True
            if self.use_ssl:
                verify = os.getenv("MINIO_CA_BUNDLE", True)
            self._url_signing_client = boto3.client(
                "s3",
                endpoint_url=f"{protocol}://{self.external_endpoint}",
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name="us-east-1",
                verify=verify,
                config=Config(
                    signature_version="s3v4", s3={"addressing_style": "path"}
                ),
            )

    def url(
        self,
        name: str,
        parameters: Optional[dict[str, Any]] = None,
        expire: int = 3600,
        http_method: Optional[str] = None,
    ) -> str:
        """
        Generate a URL for a stored file.

        - With MINIO_EXTERNAL_ENDPOINT: presigned URL signed with the external
          (browser-accessible) endpoint so the SigV4 Host header matches.
        - Without MINIO_EXTERNAL_ENDPOINT: Django proxy URL (/media/<name>) so
          the browser doesn't need to reach MinIO directly (staging).
        """
        if self.external_endpoint and hasattr(self, "_url_signing_client"):
            params: dict[str, Any] = {"Bucket": self.bucket_name, "Key": name}
            if parameters:
                params.update(parameters)
            return str(
                self._url_signing_client.generate_presigned_url(
                    "get_object",
                    Params=params,
                    ExpiresIn=expire,
                )
            )
        return f"/media/{name}"
