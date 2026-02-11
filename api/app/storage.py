import os
from storages.backends.s3boto3 import S3Boto3Storage


class MinIOStorage(S3Boto3Storage):
    """
    Custom S3Boto3Storage for MinIO.

    Uses the internal endpoint (minio:9000) for uploads/operations,
    but generates URLs with the external endpoint (localhost:39105)
    so that the browser can access files directly.
    """

    def __init__(self, **settings):
        super().__init__(**settings)
        self.external_endpoint = os.getenv('MINIO_EXTERNAL_ENDPOINT', '')
        self.use_ssl = os.getenv('MINIO_USE_SSL', 'false').lower() == 'true'

    def url(self, name, parameters=None, expire=3600, http_method=None):
        """
        Generate a presigned URL using the external endpoint
        so the browser can access the file.
        """
        url = super().url(name, parameters=parameters, expire=expire,
                          http_method=http_method)
        if self.external_endpoint:
            internal_endpoint = os.getenv('MINIO_ENDPOINT', 'minio:9000')
            protocol = 'https' if self.use_ssl else 'http'
            url = url.replace(
                f'http://{internal_endpoint}',
                f'{protocol}://{self.external_endpoint}'
            ).replace(
                f'https://{internal_endpoint}',
                f'{protocol}://{self.external_endpoint}'
            )
        return url
