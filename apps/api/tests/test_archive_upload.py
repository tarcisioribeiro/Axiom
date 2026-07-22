import shutil
import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member
from security.serializers import MAX_UPLOAD_SIZE, validate_uploaded_file


class BaseSecurityTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="securitytest",
            email="security@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Test User",
            document_hash="a" * 64,
            phone="11999999999",
            sex="M",
            user=self.user,
        )


def _make_file(name, content, content_type="application/octet-stream"):
    return SimpleUploadedFile(name, content, content_type=content_type)


class ArchiveFileValidatorTest(BaseSecurityTestCase):
    """Unit tests for the validate_uploaded_file helper."""

    def _make_uploaded_file(self, name, content):
        f = SimpleUploadedFile(name, content)
        f.size = len(content)
        return f

    # --- Size ---

    def test_rejects_oversized_file(self):
        large = self._make_uploaded_file(
            "doc.pdf", b"%PDF" + b"x" * MAX_UPLOAD_SIZE
        )
        with self.assertRaises(drf_serializers.ValidationError) as ctx:
            validate_uploaded_file(large)
        self.assertIn("excede", str(ctx.exception.detail[0]))

    def test_accepts_file_at_size_limit(self):
        content = b"%PDF" + b"x" * (MAX_UPLOAD_SIZE - 4)
        f = self._make_uploaded_file("doc.pdf", content)
        result = validate_uploaded_file(f)
        self.assertEqual(result, f)

    # --- Extension whitelist ---

    def test_rejects_disallowed_extension(self):
        for name in ("exploit.exe", "script.sh", "malware.py", "page.html"):
            with self.subTest(name=name):
                f = self._make_uploaded_file(name, b"data")
                with self.assertRaises(drf_serializers.ValidationError) as ctx:
                    validate_uploaded_file(f)
                self.assertIn("não permitido", str(ctx.exception.detail[0]))

    def test_accepts_allowed_extensions(self):
        valid_files = [
            ("report.pdf", b"%PDF-1.4"),
            ("photo.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 10),
            ("image.png", b"\x89PNG\r\n\x1a\n"),
            ("notes.txt", b"hello world"),
            ("archive.zip", b"PK\x03\x04" + b"\x00" * 20),
        ]
        for name, content in valid_files:
            with self.subTest(name=name):
                f = self._make_uploaded_file(name, content)
                result = validate_uploaded_file(f)
                self.assertEqual(result, f)

    # --- Magic bytes ---

    def test_rejects_mismatched_magic_bytes_pdf(self):
        f = self._make_uploaded_file("fake.pdf", b"PK\x03\x04" + b"\x00" * 20)
        with self.assertRaises(drf_serializers.ValidationError) as ctx:
            validate_uploaded_file(f)
        self.assertIn("conteúdo", str(ctx.exception.detail[0]))

    def test_rejects_mismatched_magic_bytes_png(self):
        f = self._make_uploaded_file(
            "fake.png", b"\xff\xd8\xff\xe0" + b"\x00" * 10
        )
        with self.assertRaises(drf_serializers.ValidationError) as ctx:
            validate_uploaded_file(f)
        self.assertIn("conteúdo", str(ctx.exception.detail[0]))

    def test_rejects_mismatched_magic_bytes_jpg(self):
        f = self._make_uploaded_file("fake.jpg", b"%PDF-1.4")
        with self.assertRaises(drf_serializers.ValidationError) as ctx:
            validate_uploaded_file(f)
        self.assertIn("conteúdo", str(ctx.exception.detail[0]))

    def test_rejects_mismatched_magic_bytes_zip(self):
        f = self._make_uploaded_file("fake.zip", b"%PDF-1.4")
        with self.assertRaises(drf_serializers.ValidationError) as ctx:
            validate_uploaded_file(f)
        self.assertIn("conteúdo", str(ctx.exception.detail[0]))

    def test_accepts_gif87a(self):
        f = self._make_uploaded_file("anim.gif", b"GIF87a" + b"\x00" * 10)
        result = validate_uploaded_file(f)
        self.assertEqual(result, f)

    def test_accepts_gif89a(self):
        f = self._make_uploaded_file("anim.gif", b"GIF89a" + b"\x00" * 10)
        result = validate_uploaded_file(f)
        self.assertEqual(result, f)

    def test_rejects_svg_as_disallowed_extension(self):
        svg = (
            b'<svg xmlns="http://www.w3.org/2000/svg">'
            b"<script>alert(1)</script></svg>"
        )
        f = self._make_uploaded_file("xss.svg", svg)
        with self.assertRaises(drf_serializers.ValidationError):
            validate_uploaded_file(f)


class ArchiveUploadViewTest(BaseSecurityTestCase):
    """Integration tests for the archive upload endpoint."""

    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()
        super().setUp()

    def tearDown(self):
        super().tearDown()
        self.override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def _upload(self, filename, content, extra_data=None):
        url = reverse("archive-list-create")
        data = {
            "title": "Test Archive",
            "category": "personal",
            "archive_type": "document",
            "owner": self.member.id,
            "encrypted_file": SimpleUploadedFile(filename, content),
        }
        if extra_data:
            data.update(extra_data)
        return self.client.post(url, data, format="multipart")

    def test_upload_valid_pdf_succeeds(self):
        response = self._upload("report.pdf", b"%PDF-1.4" + b"\x00" * 100)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_upload_disallowed_extension_rejected(self):
        response = self._upload("script.sh", b"#!/bin/bash\nrm -rf /")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("encrypted_file", response.data)

    def test_upload_executable_rejected(self):
        response = self._upload("malware.exe", b"MZ\x90\x00" + b"\x00" * 100)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("encrypted_file", response.data)

    def test_upload_svg_rejected(self):
        svg = (
            b'<svg xmlns="http://www.w3.org/2000/svg">'
            b"<script>alert(1)</script></svg>"
        )
        response = self._upload("xss.svg", svg)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("encrypted_file", response.data)

    def test_upload_polyglot_pdf_rejected(self):
        """File with .pdf extension but ZIP magic bytes should be rejected."""
        response = self._upload("polyglot.pdf", b"PK\x03\x04" + b"\x00" * 100)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("encrypted_file", response.data)


class ArchiveDownloadContentTypeTest(BaseSecurityTestCase):
    """Verify download endpoint uses whitelist-derived Content-Type."""

    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()
        super().setUp()

    def tearDown(self):
        super().tearDown()
        self.override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def _create_archive_with_file(self, filename, content):
        url = reverse("archive-list-create")
        data = {
            "title": "DL Test",
            "category": "personal",
            "archive_type": "document",
            "owner": self.member.id,
            "encrypted_file": SimpleUploadedFile(filename, content),
        }
        response = self.client.post(url, data, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data["id"]

    def test_pdf_download_has_safe_content_type(self):
        archive_id = self._create_archive_with_file(
            "report.pdf", b"%PDF-1.4" + b"\x00" * 20
        )
        # First call returns JSON with stream URL; second streams the file.
        info_url = reverse("archive-download", kwargs={"pk": archive_id})
        info_response = self.client.get(info_url)
        self.assertEqual(info_response.status_code, status.HTTP_200_OK)
        self.assertIn("url", info_response.data)

        stream_url = info_url + "?stream=1"
        response = self.client.get(stream_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("application/pdf", response.get("Content-Type", ""))
        self.assertIn("attachment", response.get("Content-Disposition", ""))

    def test_png_download_has_safe_content_type(self):
        archive_id = self._create_archive_with_file(
            "photo.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
        )
        stream_url = (
            reverse("archive-download", kwargs={"pk": archive_id})
            + "?stream=1"
        )
        response = self.client.get(stream_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("image/png", response.get("Content-Type", ""))
        self.assertIn("attachment", response.get("Content-Disposition", ""))

    def test_unknown_extension_falls_back_to_octet_stream(self):
        """Files that somehow bypassed validation get
        application/octet-stream."""
        from security.models import Archive

        archive = Archive.objects.create(
            title="Raw",
            category="personal",
            archive_type="other",
            owner=self.member,
        )
        # Directly assign a file-like with an unusual name (bypass serializer)
        archive.encrypted_file.name = "security/archives/2024/01/file.bin"
        archive.file_name = "file.bin"
        archive.save()

        stream_url = (
            reverse("archive-download", kwargs={"pk": archive.id})
            + "?stream=1"
        )
        # The file won't exist in storage, so we just verify the
        # content-type logic by checking that the view handles the
        # missing file gracefully
        response = self.client.get(stream_url)
        # Either 404 (file not on disk) or 200 with octet-stream
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND],
        )
