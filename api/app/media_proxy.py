import logging
from typing import Any

from django.conf import settings
from django.http import Http404, HttpRequest, StreamingHttpResponse
from django.views import View

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class MediaProxyView(View):
    """
    Proxy MinIO files through Django when MINIO_EXTERNAL_ENDPOINT is not set.

    Used in staging where MinIO is only accessible inside the cluster.
    The browser requests /media/<path> → ingress routes to api-service →
    this view fetches from minio-service:9000 (internal) and streams back.
    """

    _s3_client = None

    def _get_client(self) -> Any:
        if self._s3_client is None:
            MediaProxyView._s3_client = boto3.client(
                "s3",
                endpoint_url=getattr(settings, "AWS_S3_ENDPOINT_URL", None),
                aws_access_key_id=getattr(settings, "AWS_ACCESS_KEY_ID", None),
                aws_secret_access_key=getattr(
                    settings, "AWS_SECRET_ACCESS_KEY", None
                ),
                region_name=getattr(
                    settings, "AWS_S3_REGION_NAME", "us-east-1"
                ),
                verify=getattr(settings, "AWS_S3_VERIFY", True),
                config=Config(
                    signature_version="s3v4",
                    s3={"addressing_style": "path"},
                ),
            )
        return self._s3_client

    def get(self, request: HttpRequest, name: str) -> StreamingHttpResponse:
        try:
            obj = self._get_client().get_object(
                Bucket=getattr(settings, "AWS_STORAGE_BUCKET_NAME", ""),
                Key=name,
            )
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code", "")
            if error_code in ("NoSuchKey", "404"):
                raise Http404
            logger.exception("MinIO proxy error for key %s: %s", name, exc)
            raise Http404

        response = StreamingHttpResponse(
            streaming_content=obj["Body"].iter_chunks(chunk_size=65536),
            content_type=obj.get("ContentType", "application/octet-stream"),
        )
        if "ContentLength" in obj:
            response["Content-Length"] = obj["ContentLength"]
        if "ContentDisposition" in obj:
            response["Content-Disposition"] = obj["ContentDisposition"]
        response["Cache-Control"] = "private, max-age=3600"
        return response
