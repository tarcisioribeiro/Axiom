"""
Additional coverage tests for security/views.py and security/vault_config.py.

Targets branches not exercised by test_security_views.py /
test_security_improvements.py / test_security_headers.py: copy views,
archive error handling, favorite toggles, activity log CSV export, dashboard
stats with real data, vault health report with weak/duplicate/outdated
passwords and expired cards, password import confirm flow, password
generation edge cases, credential share tokens (create/list/revoke/redeem),
vault export ZIP, HIBP check, TOTP verify, vault health history, vault alert
config, security global search, vault setup/unlock error branches, vault
recovery key generate/unlock, and vault preferences.
"""

import base64
import io
import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member
from security.models import (
    ActivityLog,
    Archive,
    CredentialShareToken,
    Password,
    StoredBankAccount,
    StoredCreditCard,
    VaultConfig,
    VaultHealthSnapshot,
)
from security.vault_config import _store_vault_key_in_cache
from security.vault_crypto import VaultEncryption

# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------


class BaseSecurityCoverageTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="cov2test",
            email="cov2@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Cov2 User",
            document_hash="c" * 64,
            phone="11999999992",
            sex="M",
            user=self.user,
        )
        cache.clear()

    def tearDown(self):
        cache.clear()

    def _make_password(self, title="Gmail", password="Str0ng!Pass1", **extra):
        pw = Password(
            title=title,
            username=extra.pop("username", "user@example.com"),
            category=extra.pop("category", "email"),
            owner=self.member,
            created_by=self.user,
            updated_by=self.user,
            **extra,
        )
        pw.password = password
        pw.save()
        return pw

    def _make_card(
        self, name="My Visa", card_number="4532015112830366", **extra
    ):
        card = StoredCreditCard(
            name=name,
            expiration_month=extra.pop("expiration_month", 12),
            expiration_year=extra.pop("expiration_year", 2030),
            cardholder_name=extra.pop("cardholder_name", "Test User"),
            flag=extra.pop("flag", "VSA"),
            owner=self.member,
            created_by=self.user,
            updated_by=self.user,
            **extra,
        )
        card.card_number = card_number
        card.security_code = "123"
        card.save()
        return card

    def _make_account(self, name="Nubank", **extra):
        acc = StoredBankAccount(
            name=name,
            institution_name=extra.pop("institution_name", "Nubank"),
            account_type=extra.pop("account_type", "CC"),
            owner=self.member,
            created_by=self.user,
            updated_by=self.user,
            **extra,
        )
        acc.account_number = "123456789"
        acc.save()
        return acc

    def _make_archive(self, title="Doc", text="hello world", **extra):
        arch = Archive(
            title=title,
            category=extra.pop("category", "personal"),
            archive_type=extra.pop("archive_type", "text"),
            owner=self.member,
            created_by=self.user,
            updated_by=self.user,
            **extra,
        )
        if text is not None:
            arch.text_content = text
        arch.save()
        return arch


# ---------------------------------------------------------------------------
# Copy views (Password / Card / Account)
# ---------------------------------------------------------------------------


class CopyViewsTest(BaseSecurityCoverageTestCase):
    def test_password_copy_view(self):
        pw = self._make_password("CopyMe")
        url = reverse("password-copy", args=[pw.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        log = ActivityLog.objects.filter(
            action="copy", model_name="Password"
        ).first()
        self.assertIsNotNone(log)

    def test_stored_card_copy_view(self):
        card = self._make_card("CopyCard")
        url = reverse("stored-card-copy", args=[card.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        log = ActivityLog.objects.filter(
            action="copy", model_name="StoredCreditCard"
        ).first()
        self.assertIsNotNone(log)

    def test_stored_account_copy_view(self):
        acc = self._make_account("CopyAccount")
        url = reverse("stored-account-copy", args=[acc.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        log = ActivityLog.objects.filter(
            action="copy", model_name="StoredBankAccount"
        ).first()
        self.assertIsNotNone(log)


# ---------------------------------------------------------------------------
# Favorite toggle views
# ---------------------------------------------------------------------------


class FavoriteToggleTest(BaseSecurityCoverageTestCase):
    def test_password_favorite_toggle(self):
        pw = self._make_password("FavPW")
        url = reverse("password-favorite-toggle", args=[pw.pk])
        resp = self.client.patch(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        pw.refresh_from_db()
        self.assertTrue(pw.is_favorite)

    def test_card_favorite_toggle(self):
        card = self._make_card("FavCard")
        url = reverse("stored-card-favorite-toggle", args=[card.pk])
        resp = self.client.patch(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        card.refresh_from_db()
        self.assertTrue(card.is_favorite)

    def test_account_favorite_toggle(self):
        acc = self._make_account("FavAccount")
        url = reverse("stored-account-favorite-toggle", args=[acc.pk])
        resp = self.client.patch(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        acc.refresh_from_db()
        self.assertTrue(acc.is_favorite)

    def test_archive_favorite_toggle(self):
        arch = self._make_archive("FavArchive")
        url = reverse("archive-favorite-toggle", args=[arch.pk])
        resp = self.client.patch(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        arch.refresh_from_db()
        self.assertTrue(arch.is_favorite)


# ---------------------------------------------------------------------------
# Archive perform_create / perform_update error handling
# ---------------------------------------------------------------------------


class ArchiveSaveErrorTest(BaseSecurityCoverageTestCase):
    def _data(self):
        return {
            "title": "ErrArchive",
            "category": "personal",
            "archive_type": "text",
            "text_content": "secret",
            "tags": [],
            "owner": self.member.pk,
        }

    def test_create_permission_error_returns_400(self):
        url = reverse("archive-list-create")
        with patch(
            "security.serializers.ArchiveCreateUpdateSerializer.save",
            side_effect=PermissionError("denied"),
        ):
            resp = self.client.post(url, self._data(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("encrypted_file", resp.data)

    def test_create_oserror_returns_400(self):
        url = reverse("archive-list-create")
        err = OSError(5, "I/O error")
        with patch(
            "security.serializers.ArchiveCreateUpdateSerializer.save",
            side_effect=err,
        ):
            resp = self.client.post(url, self._data(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("encrypted_file", resp.data)

    def test_update_permission_error_returns_400(self):
        arch = self._make_archive("ToUpdate")
        url = reverse("archive-detail", args=[arch.pk])
        with patch(
            "security.serializers.ArchiveCreateUpdateSerializer.save",
            side_effect=PermissionError("denied"),
        ):
            resp = self.client.patch(url, {"title": "New"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_oserror_returns_400(self):
        arch = self._make_archive("ToUpdate2")
        url = reverse("archive-detail", args=[arch.pk])
        err = OSError(5, "I/O error")
        with patch(
            "security.serializers.ArchiveCreateUpdateSerializer.save",
            side_effect=err,
        ):
            resp = self.client.patch(url, {"title": "New"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Archive reveal / download
# ---------------------------------------------------------------------------


class ArchiveRevealDownloadTest(BaseSecurityCoverageTestCase):
    def test_reveal_no_text_content(self):
        arch = self._make_archive("NoText", text=None)
        url = reverse("archive-reveal", args=[arch.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["error_type"], "no_content")

    def test_reveal_with_text_content(self):
        arch = self._make_archive("HasText", text="my secret note")
        url = reverse("archive-reveal", args=[arch.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["text_content"], "my secret note")

    def test_reveal_decryption_exception(self):
        arch = self._make_archive("BrokenText", text="content")
        url = reverse("archive-reveal", args=[arch.pk])
        with patch(
            "security.models.Archive.text_content",
            new_callable=lambda: property(
                lambda self: (_ for _ in ()).throw(Exception("boom"))
            ),
        ):
            resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["error_type"], "decryption_failed")

    def test_download_archive_not_found(self):
        url = reverse("archive-download", args=[999999])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_download_archive_without_file(self):
        arch = self._make_archive("NoFile", text="x")
        url = reverse("archive-download", args=[arch.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_download_returns_stream_url(self):
        arch = self._make_archive("WithFile", text=None)
        arch.encrypted_file.save(
            "test.txt", io.BytesIO(b"file bytes"), save=True
        )
        url = reverse("archive-download", args=[arch.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("url", resp.data)
        self.assertIn("stream=1", resp.data["url"])

    def test_download_stream_returns_file(self):
        arch = self._make_archive("WithFile2", text=None)
        arch.encrypted_file.save(
            "test2.txt", io.BytesIO(b"file bytes 2"), save=True
        )
        url = reverse("archive-download", args=[arch.pk]) + "?stream=1"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Activity log CSV export
# ---------------------------------------------------------------------------


class ActivityLogExportTest(BaseSecurityCoverageTestCase):
    def test_export_csv(self):
        self._make_password("ForLog")
        url = reverse("activity-log-export")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", resp["Content-Type"])


# ---------------------------------------------------------------------------
# Security dashboard stats (with real data)
# ---------------------------------------------------------------------------


class SecurityDashboardStatsDataTest(BaseSecurityCoverageTestCase):
    def test_dashboard_stats_with_items(self):
        # Create via the API (not direct model creation) so that
        # log_activity() records ActivityLog entries, exercising the
        # activities_by_action / activities_timeline / recent_activity
        # branches.
        self.client.post(
            reverse("password-list-create"),
            {
                "title": "DashPW",
                "username": "dash@example.com",
                "password": "Str0ng!Passw0rd1",
                "category": "email",
                "owner": self.member.pk,
            },
        )
        self._make_card("DashCard")
        self._make_account("DashAccount")
        self._make_archive("DashArchive")
        url = reverse("security-dashboard-stats")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.data
        self.assertEqual(data["total_passwords"], 1)
        self.assertEqual(data["total_stored_cards"], 1)
        self.assertEqual(data["total_stored_accounts"], 1)
        self.assertEqual(data["total_archives"], 1)
        types = {i["type"] for i in data["items_distribution"]}
        self.assertEqual(types, {"passwords", "cards", "accounts", "archives"})
        self.assertTrue(len(data["activities_by_action"]) > 0)
        self.assertTrue(len(data["recent_activity"]) > 0)
        self.assertGreater(len(data["password_strength_distribution"]), 0)

    def test_dashboard_stats_no_member(self):
        # Remove the member link so the "no member" branch is exercised.
        self.member.delete()
        url = reverse("security-dashboard-stats")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["total_passwords"], 0)
        self.assertEqual(resp.data["items_distribution"], [])


# ---------------------------------------------------------------------------
# Vault health report — weak/medium/strong, duplicates, outdated, cards,
# accounts
# ---------------------------------------------------------------------------


class VaultHealthReportDataTest(BaseSecurityCoverageTestCase):
    def test_health_report_full_scenario(self):
        # Weak password
        self._make_password("Weak1", password="abc")
        # Medium password
        self._make_password("Medium1", password="abcdef12")
        # Strong password
        self._make_password("Strong1", password="Str0ng!Passw0rd#99")
        # Duplicate passwords (same plaintext)
        self._make_password("Dup1", password="DuplicateVal1!")
        self._make_password("Dup2", password="DuplicateVal1!")
        # Outdated password
        outdated = self._make_password(
            "Outdated1", password="Str0ng!Old99Pass"
        )
        Password.objects.filter(pk=outdated.pk).update(
            last_password_change=timezone.now() - timedelta(days=200)
        )
        # Expired card
        self._make_card(
            "ExpiredCard", expiration_month=1, expiration_year=2020
        )
        # Account without password
        self._make_account("NoPwAccount")

        with patch(
            "security.views.urllib.request.urlopen", side_effect=Exception
        ):
            url = reverse("password-health-report")
            resp = self.client.get(url)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.data
        self.assertGreater(data["issues_summary"]["weak"], 0)
        self.assertGreater(data["issues_summary"]["medium"], 0)
        self.assertGreater(data["issues_summary"]["duplicate"], 0)
        self.assertGreater(data["issues_summary"]["outdated"], 0)
        self.assertEqual(data["issues_summary"]["expired_cards"], 1)
        self.assertEqual(
            data["issues_summary"]["accounts_without_password"], 1
        )
        self.assertTrue(len(data["problematic_passwords"]) > 0)
        self.assertTrue(len(data["problematic_cards"]) > 0)
        self.assertTrue(len(data["problematic_accounts"]) > 0)

        # A snapshot should have been created for today.
        snap = VaultHealthSnapshot.objects.filter(owner=self.member).first()
        self.assertIsNotNone(snap)

        # Calling again the same day should update (not duplicate) the
        # snapshot.
        with patch(
            "security.views.urllib.request.urlopen", side_effect=Exception
        ):
            resp2 = self.client.get(url)
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(
            VaultHealthSnapshot.objects.filter(owner=self.member).count(), 1
        )

    def test_health_report_no_member(self):
        self.member.delete()
        url = reverse("password-health-report")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["score"], 100)

    def test_health_report_hibp_compromised_flow(self):
        pw = self._make_password("HibpPW", password="Str0ng!Passw0rd#12")
        sha1_upper = (
            __import__("hashlib")
            .sha1(b"Str0ng!Passw0rd#12", usedforsecurity=False)
            .hexdigest()
            .upper()
        )
        suffix = sha1_upper[5:]
        fake_body = f"{suffix}:5\n".encode()

        class FakeResp:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return fake_body

        with patch(
            "security.views.urllib.request.urlopen", return_value=FakeResp()
        ):
            url = reverse("password-health-report")
            resp = self.client.get(url)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        pw.refresh_from_db()
        self.assertTrue(pw.hibp_compromised)

        # Notification should have been created.
        from notifications.models import Notification

        notif = Notification.objects.filter(
            owner=self.member, notification_type="vault_breach_detected"
        ).first()
        self.assertIsNotNone(notif)


# ---------------------------------------------------------------------------
# Password import preview — error branches
# ---------------------------------------------------------------------------


class PasswordImportPreviewErrorsTest(BaseSecurityCoverageTestCase):
    def test_unsupported_format_rejected(self):
        f = SimpleUploadedFile("f.csv", b"a,b\n1,2\n", content_type="text/csv")
        url = reverse("password-import-preview")
        resp = self.client.post(url, {"file": f, "format": "unknown_fmt"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_parse_error_returns_422(self):
        f = SimpleUploadedFile(
            "f.json", b"not valid json{{{", content_type="application/json"
        )
        url = reverse("password-import-preview")
        resp = self.client.post(url, {"file": f, "format": "bitwarden_json"})
        self.assertEqual(
            resp.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY
        )

    def test_no_file_returns_400(self):
        url = reverse("password-import-preview")
        resp = self.client.post(url, {"format": "bitwarden_json"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_preview_flags_duplicate_entries(self):
        self._make_password("Gmail", username="user@gmail.com")
        payload = {
            "items": [
                {
                    "type": 1,
                    "name": "Gmail",
                    "login": {
                        "username": "user@gmail.com",
                        "password": "secret",
                        "uris": [],
                    },
                }
            ]
        }
        f = SimpleUploadedFile(
            "f.json",
            json.dumps(payload).encode(),
            content_type="application/json",
        )
        url = reverse("password-import-preview")
        resp = self.client.post(url, {"file": f, "format": "bitwarden_json"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["duplicates_count"], 1)
        self.assertTrue(resp.data["entries"][0]["is_duplicate"])


# ---------------------------------------------------------------------------
# Password import confirm
# ---------------------------------------------------------------------------


class PasswordImportConfirmTest(BaseSecurityCoverageTestCase):
    def test_empty_entries_rejected(self):
        url = reverse("password-import-confirm")
        resp = self.client.post(url, {"entries": []}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_entries_not_a_list_rejected(self):
        url = reverse("password-import-confirm")
        resp = self.client.post(url, {"entries": "not-a-list"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_successful_import_with_category_mapping(self):
        url = reverse("password-import-confirm")
        entries = [
            {
                "index": 0,
                "title": "NewSite",
                "username": "user1",
                "password": "secret1",
                "site": "https://newsite.com",
                "category": "other",
                "notes": "",
            },
            {
                # Missing title/password -> counted as error
                "index": 1,
                "title": "",
                "username": "user2",
                "password": "",
            },
        ]
        resp = self.client.post(
            url,
            {
                "entries": entries,
                "category_mapping": {"0": "banking"},
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["imported"], 1)
        self.assertEqual(resp.data["errors"], 1)
        pw = Password.objects.get(title="NewSite")
        self.assertEqual(pw.category, "banking")

    def test_duplicate_entries_skipped(self):
        self._make_password("Existing", username="dupuser")
        url = reverse("password-import-confirm")
        entries = [
            {
                "index": 0,
                "title": "Existing",
                "username": "dupuser",
                "password": "whatever",
            }
        ]
        resp = self.client.post(url, {"entries": entries}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["duplicates_skipped"], 1)
        self.assertEqual(resp.data["imported"], 0)

    def test_invalid_category_mapping_falls_back(self):
        url = reverse("password-import-confirm")
        entries = [
            {
                "index": 0,
                "title": "Fallback",
                "username": "u",
                "password": "p",
                "category": "email",
            }
        ]
        resp = self.client.post(
            url,
            {"entries": entries, "category_mapping": {"0": "not_a_category"}},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        pw = Password.objects.get(title="Fallback")
        self.assertEqual(pw.category, "email")

    def test_save_exception_counted_as_error(self):
        url = reverse("password-import-confirm")
        entries = [
            {
                "index": 0,
                "title": "WillFail",
                "username": "u",
                "password": "p",
            }
        ]
        with patch(
            "security.models.Password.save", side_effect=Exception("db down")
        ):
            resp = self.client.post(url, {"entries": entries}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["errors"], 1)
        self.assertEqual(resp.data["imported"], 0)


# ---------------------------------------------------------------------------
# Password generation edge cases
# ---------------------------------------------------------------------------


class PasswordGenerateEdgeCasesTest(BaseSecurityCoverageTestCase):
    def test_generate_with_exclude_ambiguous_all_types(self):
        url = reverse("password-generate")
        resp = self.client.post(
            url,
            {
                "length": 32,
                "uppercase": True,
                "lowercase": True,
                "numbers": True,
                "special_characters": True,
                "exclude_ambiguous": True,
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        generated = resp.data["password"]
        for ch in "0OIl1|":
            self.assertNotIn(ch, generated)

    def test_generate_no_charset_selected(self):
        url = reverse("password-generate")
        resp = self.client.post(
            url,
            {
                "length": 16,
                "uppercase": False,
                "lowercase": False,
                "numbers": False,
                "special_characters": False,
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Credential share tokens: list/create/revoke/redeem
# ---------------------------------------------------------------------------


class ShareTokenPasswordTest(BaseSecurityCoverageTestCase):
    def test_list_and_create_token(self):
        pw = self._make_password("ShareMe", password="Sh4red!Passw0rd")
        list_url = reverse("password-share-token-list-create", args=[pw.pk])
        resp = self.client.get(list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 0)

        resp = self.client.post(list_url, {"ttl_hours": 1, "max_uses": 2})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn("token_key", resp.data)
        token_uuid = resp.data["token"]

        resp = self.client.get(list_url)
        self.assertEqual(len(resp.data), 1)
        return pw, token_uuid, resp

    def test_redeem_password_token_success(self):
        pw = self._make_password("RedeemMe", password="R3deem!Passw0rd")
        list_url = reverse("password-share-token-list-create", args=[pw.pk])
        create_resp = self.client.post(
            list_url, {"ttl_hours": 1, "max_uses": 1}
        )
        token_uuid = create_resp.data["token"]
        token_key = create_resp.data["token_key"]

        redeem_url = reverse("share-token-redeem", args=[token_uuid])
        anon_client = APIClient()
        resp = anon_client.post(redeem_url, {"key": token_key})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["password"], "R3deem!Passw0rd")
        self.assertEqual(resp.data["credential_type"], "password")

    def test_redeem_missing_key(self):
        pw = self._make_password("NoKey")
        list_url = reverse("password-share-token-list-create", args=[pw.pk])
        create_resp = self.client.post(
            list_url, {"ttl_hours": 1, "max_uses": 1}
        )
        token_uuid = create_resp.data["token"]

        redeem_url = reverse("share-token-redeem", args=[token_uuid])
        anon_client = APIClient()
        resp = anon_client.post(redeem_url, {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_redeem_invalid_token(self):
        import uuid as uuid_mod

        redeem_url = reverse("share-token-redeem", args=[uuid_mod.uuid4()])
        anon_client = APIClient()
        resp = anon_client.post(redeem_url, {"key": "whatever"})
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_redeem_wrong_key(self):
        pw = self._make_password("WrongKeyPW")
        list_url = reverse("password-share-token-list-create", args=[pw.pk])
        create_resp = self.client.post(
            list_url, {"ttl_hours": 1, "max_uses": 1}
        )
        token_uuid = create_resp.data["token"]

        redeem_url = reverse("share-token-redeem", args=[token_uuid])
        anon_client = APIClient()
        bad_key = base64.urlsafe_b64encode(b"0" * 32).decode()
        resp = anon_client.post(redeem_url, {"key": bad_key})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_redeem_revoked_token(self):
        pw = self._make_password("RevokedPW")
        list_url = reverse("password-share-token-list-create", args=[pw.pk])
        create_resp = self.client.post(
            list_url, {"ttl_hours": 1, "max_uses": 1}
        )
        token_uuid = create_resp.data["token"]
        token_key = create_resp.data["token_key"]
        token_id = create_resp.data["id"]

        revoke_url = reverse("share-token-revoke", args=[token_id])
        resp = self.client.delete(revoke_url)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

        redeem_url = reverse("share-token-redeem", args=[token_uuid])
        anon_client = APIClient()
        resp = anon_client.post(redeem_url, {"key": token_key})
        self.assertEqual(resp.status_code, status.HTTP_410_GONE)

    def test_redeem_exhausted_token(self):
        pw = self._make_password("ExhaustedPW")
        list_url = reverse("password-share-token-list-create", args=[pw.pk])
        create_resp = self.client.post(
            list_url, {"ttl_hours": 1, "max_uses": 1}
        )
        token_uuid = create_resp.data["token"]
        token_key = create_resp.data["token_key"]

        redeem_url = reverse("share-token-redeem", args=[token_uuid])
        anon_client = APIClient()
        resp = anon_client.post(redeem_url, {"key": token_key})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Second redeem exceeds max_uses=1
        resp = anon_client.post(redeem_url, {"key": token_key})
        self.assertEqual(resp.status_code, status.HTTP_410_GONE)

    def test_redeem_ip_restricted_denied(self):
        pw = self._make_password("IPRestrictedPW")
        list_url = reverse("password-share-token-list-create", args=[pw.pk])
        create_resp = self.client.post(
            list_url,
            {
                "ttl_hours": 1,
                "max_uses": 1,
                "allowed_ips": ["10.0.0.1"],
            },
        )
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        token_uuid = create_resp.data["token"]
        token_key = create_resp.data["token_key"]

        redeem_url = reverse("share-token-redeem", args=[token_uuid])
        anon_client = APIClient()
        resp = anon_client.post(redeem_url, {"key": token_key})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_redeem_legacy_plaintext_snapshot(self):
        from app.encryption import FieldEncryption

        pw = self._make_password("LegacyPW", password="LegacyVal!123")
        token_key = FieldEncryption.generate_key()
        encrypted_snapshot = FieldEncryption.encrypt_with_key(
            "LegacyPlainPassword", token_key.encode()
        )
        token_obj = CredentialShareToken.objects.create(
            credential_type="password",
            password=pw,
            _encrypted_password=encrypted_snapshot,
            expires_at=timezone.now() + timedelta(hours=1),
            max_uses=1,
            created_by=self.user,
        )
        redeem_url = reverse("share-token-redeem", args=[token_obj.token])
        anon_client = APIClient()
        resp = anon_client.post(redeem_url, {"key": token_key})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["password"], "LegacyPlainPassword")
        self.assertEqual(resp.data["title"], pw.title)


class ShareTokenCardAccountTest(BaseSecurityCoverageTestCase):
    def test_card_share_token_list_and_create(self):
        card = self._make_card("ShareCard")
        list_url = reverse(
            "stored-card-share-token-list-create", args=[card.pk]
        )
        resp = self.client.get(list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        resp = self.client.post(list_url, {"ttl_hours": 1, "max_uses": 1})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        return card, resp

    def test_redeem_card_token(self):
        card, create_resp = self.test_card_share_token_list_and_create()
        token_uuid = create_resp.data["token"]
        token_key = create_resp.data["token_key"]
        redeem_url = reverse("share-token-redeem", args=[token_uuid])
        anon_client = APIClient()
        resp = anon_client.post(redeem_url, {"key": token_key})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["credential_type"], "stored_credit_card")
        self.assertEqual(resp.data["name"], card.name)

    def test_account_share_token_list_and_create(self):
        acc = self._make_account("ShareAccount")
        list_url = reverse(
            "stored-account-share-token-list-create", args=[acc.pk]
        )
        resp = self.client.get(list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        resp = self.client.post(list_url, {"ttl_hours": 1, "max_uses": 1})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        return acc, resp

    def test_redeem_account_token(self):
        acc, create_resp = self.test_account_share_token_list_and_create()
        token_uuid = create_resp.data["token"]
        token_key = create_resp.data["token_key"]
        redeem_url = reverse("share-token-redeem", args=[token_uuid])
        anon_client = APIClient()
        resp = anon_client.post(redeem_url, {"key": token_key})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["credential_type"], "stored_bank_account")
        self.assertEqual(resp.data["name"], acc.name)


# ---------------------------------------------------------------------------
# Vault export ZIP
# ---------------------------------------------------------------------------


class VaultExportZipTest(BaseSecurityCoverageTestCase):
    def test_export_zip_no_member(self):
        self.member.delete()
        url = reverse("vault-export-zip")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_export_zip_with_full_data(self):
        self._make_password("ExportPW", password="Exp0rt!Passw0rd")
        self._make_card("ExportCard")
        self._make_account("ExportAccount")
        self._make_archive("ExportArchiveText", text="secret text")
        arch2 = self._make_archive("ExportArchiveFile", text=None)
        arch2.encrypted_file.save(
            "export.txt", io.BytesIO(b"exported bytes"), save=True
        )

        url = reverse("vault-export-zip")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "application/octet-stream")
        self.assertEqual(resp["X-Vault-Export-Format"], "AES-256-GCM")
        self.assertTrue(len(resp.content) > 12)


# ---------------------------------------------------------------------------
# HIBP check view
# ---------------------------------------------------------------------------


class HibpCheckViewTest(BaseSecurityCoverageTestCase):
    def test_missing_prefix(self):
        url = reverse("hibp-check")
        resp = self.client.post(url, {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_prefix_format(self):
        url = reverse("hibp-check")
        resp = self.client.post(url, {"prefix": "ZZZZZ"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_successful_check(self):
        class FakeResp:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return b"ABCDEF1234:3\n"

        url = reverse("hibp-check")
        with patch(
            "security.views.urllib.request.urlopen", return_value=FakeResp()
        ):
            resp = self.client.post(url, {"prefix": "ABCDE"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("suffixes", resp.data)

    def test_service_unavailable(self):
        url = reverse("hibp-check")
        with patch(
            "security.views.urllib.request.urlopen",
            side_effect=Exception("timeout"),
        ):
            resp = self.client.post(url, {"prefix": "ABCDE"})
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)


# ---------------------------------------------------------------------------
# TOTP verify view
# ---------------------------------------------------------------------------


class TOTPVerifyViewTest(BaseSecurityCoverageTestCase):
    def test_password_not_found(self):
        url = reverse("password-totp-verify", args=[999999])
        resp = self.client.post(url, {"code": "123456"})
        self.assertEqual(resp.status_code, 404)

    def test_totp_not_enabled(self):
        pw = self._make_password("NoTotp")
        url = reverse("password-totp-verify", args=[pw.pk])
        resp = self.client.post(url, {"code": "123456"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["valid"])

    def test_totp_valid_code(self):
        import pyotp

        secret = pyotp.random_base32()
        pw = self._make_password("TotpPW")
        pw.totp_enabled = True
        pw.totp_secret = secret
        pw.save()

        code = pyotp.TOTP(secret).now()
        url = reverse("password-totp-verify", args=[pw.pk])
        resp = self.client.post(url, {"code": code})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["valid"])

    def test_totp_invalid_code(self):
        import pyotp

        secret = pyotp.random_base32()
        pw = self._make_password("TotpPW2")
        pw.totp_enabled = True
        pw.totp_secret = secret
        pw.save()

        url = reverse("password-totp-verify", args=[pw.pk])
        resp = self.client.post(url, {"code": "000000"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["valid"])


# ---------------------------------------------------------------------------
# Password history
# ---------------------------------------------------------------------------


class PasswordHistoryTest(BaseSecurityCoverageTestCase):
    def test_history_list_no_member(self):
        # Password.owner uses on_delete=PROTECT, so the member must have no
        # owned passwords before it can be deleted.
        self.member.delete()
        url = reverse("password-history", args=[999999])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["results"], [])

    def test_history_list_with_entries(self):
        pw = self._make_password("HistPW2", password="First!Passw0rd")
        # Trigger a password change via PATCH to create a PasswordHistory
        # entry (if the serializer supports it) — otherwise create directly.
        from security.models import PasswordHistory

        PasswordHistory.objects.create(
            password=pw,
            _old_password="irrelevant-encrypted-blob",
            changed_by=self.user,
        )
        url = reverse("password-history", args=[pw.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)


# ---------------------------------------------------------------------------
# Vault health history
# ---------------------------------------------------------------------------


class VaultHealthHistoryTest(BaseSecurityCoverageTestCase):
    def test_history_no_member(self):
        self.member.delete()
        url = reverse("vault-health-history")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["results"], [])

    def test_history_with_snapshots(self):
        VaultHealthSnapshot.objects.create(
            owner=self.member,
            score=80,
            weak_passwords=1,
            medium_passwords=1,
            duplicate_passwords=0,
            outdated_passwords=0,
            total_passwords=2,
            created_by=self.user,
            updated_by=self.user,
        )
        url = reverse("vault-health-history")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)


# ---------------------------------------------------------------------------
# Vault alert config
# ---------------------------------------------------------------------------


class VaultAlertConfigTest(BaseSecurityCoverageTestCase):
    def test_get_creates_default(self):
        url = reverse("vault-alert-config")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("alert_on_new_ip", resp.data)

    def test_put_updates_config(self):
        url = reverse("vault-alert-config")
        resp = self.client.put(
            url, {"alert_on_new_ip": False, "notify_email": False}
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["alert_on_new_ip"])


# ---------------------------------------------------------------------------
# Security global search
# ---------------------------------------------------------------------------


class SecuritySearchTest(BaseSecurityCoverageTestCase):
    def test_query_too_short(self):
        url = reverse("security-search") + "?q=a"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["total"], 0)

    def test_search_no_member(self):
        self.member.delete()
        url = reverse("security-search") + "?q=gmail"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["total"], 0)

    def test_search_finds_all_types(self):
        self._make_password("SearchGmail", username="findme@gmail.com")
        self._make_card("SearchCard")
        self._make_account("SearchBank")
        self._make_archive("SearchArchive")
        url = reverse("security-search") + "?q=Search"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["total"], 4)
        self.assertEqual(len(resp.data["passwords"]), 1)
        self.assertEqual(len(resp.data["stored_cards"]), 1)
        self.assertEqual(len(resp.data["stored_accounts"]), 1)
        self.assertEqual(len(resp.data["archives"]), 1)


# ---------------------------------------------------------------------------
# Vault config: setup / unlock error branches, mixin, recovery key
# ---------------------------------------------------------------------------


class VaultSetupReEncryptTest(BaseSecurityCoverageTestCase):
    def test_setup_reencrypts_existing_items(self):
        self._make_password("PreSetupPW", password="Pre!Setup123")
        self._make_card("PreSetupCard")
        self._make_account("PreSetupAccount")
        self._make_archive("PreSetupArchiveText", text="pre setup text")
        arch_file = self._make_archive("PreSetupArchiveFile", text=None)
        arch_file.encrypted_file.save(
            "pre.txt", io.BytesIO(b"pre setup bytes"), save=True
        )

        url = reverse("vault-setup")
        resp = self.client.post(
            url,
            {
                "master_password": "Str0ng!Setup99",
                "confirm_master_password": "Str0ng!Setup99",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(VaultConfig.objects.filter(owner=self.member).exists())

        # Status should now report configured + unlocked.
        status_url = reverse("vault-status")
        status_resp = self.client.get(status_url)
        self.assertTrue(status_resp.data["is_configured"])
        self.assertTrue(status_resp.data["is_unlocked"])


class VaultKeyExpiryTest(BaseSecurityCoverageTestCase):
    """
    Directly exercises _get_vault_key_expiry()'s ttl branches. The test
    cache backend (LocMemCache) doesn't implement .ttl(), so the view-level
    flow always hits the AttributeError branch — these tests patch
    cache.ttl directly to cover the remaining branches.
    """

    def test_expiry_with_no_ttl_support(self):
        from security.vault_config import _get_vault_key_expiry

        # LocMemCache has no .ttl() -> AttributeError -> None.
        self.assertIsNone(_get_vault_key_expiry(self.user.id))

    def test_expiry_with_zero_or_none_ttl(self):
        from security.vault_config import _get_vault_key_expiry

        with patch(
            "security.vault_config.cache.ttl", return_value=0, create=True
        ):
            self.assertIsNone(_get_vault_key_expiry(self.user.id))
        with patch(
            "security.vault_config.cache.ttl", return_value=None, create=True
        ):
            self.assertIsNone(_get_vault_key_expiry(self.user.id))

    def test_expiry_with_positive_ttl(self):
        from security.vault_config import _get_vault_key_expiry

        with patch(
            "security.vault_config.cache.ttl", return_value=300, create=True
        ):
            result = _get_vault_key_expiry(self.user.id)
        self.assertIsNotNone(result)

    def test_setup_exception_rolls_back(self):
        url = reverse("vault-setup")
        with patch(
            "security.vault_config._re_encrypt_all_items",
            side_effect=Exception("boom"),
        ):
            resp = self.client.post(
                url,
                {
                    "master_password": "Str0ng!Setup99",
                    "confirm_master_password": "Str0ng!Setup99",
                },
            )
        self.assertEqual(
            resp.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR
        )
        self.assertFalse(
            VaultConfig.objects.filter(owner=self.member).exists()
        )

    def test_reencrypt_password_decrypt_failure_raises(self):
        from security.vault_config import _re_encrypt_all_items

        pw = self._make_password("BadDecryptPW")
        pw._password = "not-a-valid-fernet-token"
        pw.save(update_fields=["_password"])

        with self.assertRaises(Exception):
            _re_encrypt_all_items(self.member, b"0" * 32)


class VaultLockedMixinNoMemberTest(BaseSecurityCoverageTestCase):
    def test_view_without_member_uses_app_key_mode(self):
        self.member.delete()
        # Recreate member-less scenario: PasswordListCreateView still works
        # (VaultLockedMixin treats "no member" as no VaultConfig -> app-key
        # mode), just returns empty list since Password.owner FK requires a
        # member — use the raw dispatch path instead via activity logs
        # export which doesn't need a member either.
        url = reverse("activity-log-list")
        resp = self.client.get(url)
        self.assertNotEqual(resp.status_code, 423)


class VaultUnlockGenericErrorTest(BaseSecurityCoverageTestCase):
    def _setup_vault(self, master_password="Str0ng!Pass99"):
        salt = VaultEncryption.generate_salt()
        derived = VaultEncryption.derive_key(master_password, salt)
        vault_key = VaultEncryption.generate_vault_key()
        encrypted = VaultEncryption.encrypt_vault_key(vault_key, derived)
        VaultConfig.objects.create(
            owner=self.member,
            salt=base64.b64encode(salt).decode(),
            encrypted_vault_key=encrypted,
        )
        return vault_key

    def test_unlock_no_member(self):
        self.member.delete()
        url = reverse("vault-unlock")
        resp = self.client.post(url, {"master_password": "Whatever1!"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unlock_not_configured(self):
        url = reverse("vault-unlock")
        resp = self.client.post(url, {"master_password": "Whatever1!"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unlock_generic_exception_returns_500(self):
        self._setup_vault()
        url = reverse("vault-unlock")
        with patch(
            "security.vault_config.VaultEncryption.decrypt_vault_key",
            side_effect=Exception("unexpected"),
        ):
            resp = self.client.post(url, {"master_password": "Str0ng!Pass99"})
        self.assertEqual(
            resp.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class VaultRecoveryKeyTest(BaseSecurityCoverageTestCase):
    def _setup_and_unlock_vault(self, master_password="Str0ng!Pass99"):
        salt = VaultEncryption.generate_salt()
        derived = VaultEncryption.derive_key(master_password, salt)
        vault_key = VaultEncryption.generate_vault_key()
        encrypted = VaultEncryption.encrypt_vault_key(vault_key, derived)
        VaultConfig.objects.create(
            owner=self.member,
            salt=base64.b64encode(salt).decode(),
            encrypted_vault_key=encrypted,
        )
        _store_vault_key_in_cache(self.user.id, vault_key)
        return vault_key

    def test_generate_no_member(self):
        self.member.delete()
        url = reverse("vault-recovery-key-generate")
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_generate_vault_locked(self):
        url = reverse("vault-recovery-key-generate")
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_generate_vault_not_configured(self):
        # Unlock cache present but no VaultConfig row.
        _store_vault_key_in_cache(self.user.id, b"0" * 32)
        url = reverse("vault-recovery-key-generate")
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_generate_success_and_recovery_unlock(self):
        self._setup_and_unlock_vault("Str0ng!Pass99")
        gen_url = reverse("vault-recovery-key-generate")
        resp = self.client.post(gen_url)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        recovery_key = resp.data["recovery_key"]

        # Lock the vault, then unlock via recovery key.
        self.client.post(reverse("vault-lock"))
        unlock_url = reverse("vault-recovery-unlock")
        resp = self.client.post(unlock_url, {"recovery_key": recovery_key})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_recovery_unlock_missing_key(self):
        url = reverse("vault-recovery-unlock")
        resp = self.client.post(url, {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_recovery_unlock_no_member(self):
        self.member.delete()
        url = reverse("vault-recovery-unlock")
        resp = self.client.post(url, {"recovery_key": "AAAAAA-BBBBBB"})
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_recovery_unlock_not_configured(self):
        url = reverse("vault-recovery-unlock")
        resp = self.client.post(url, {"recovery_key": "AAAAAA-BBBBBB"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_recovery_unlock_no_recovery_key_generated(self):
        self._setup_and_unlock_vault()
        url = reverse("vault-recovery-unlock")
        resp = self.client.post(url, {"recovery_key": "AAAAAA-BBBBBB"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_recovery_unlock_invalid_key(self):
        self._setup_and_unlock_vault("Str0ng!Pass99")
        gen_url = reverse("vault-recovery-key-generate")
        self.client.post(gen_url)

        url = reverse("vault-recovery-unlock")
        resp = self.client.post(
            url, {"recovery_key": "WRONG1-WRONG2-WRONG3-WRONG4-WRONG5-WRONG6"}
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class VaultPreferencesTest(BaseSecurityCoverageTestCase):
    def _setup_vault(self, master_password="Str0ng!Pass99"):
        salt = VaultEncryption.generate_salt()
        derived = VaultEncryption.derive_key(master_password, salt)
        vault_key = VaultEncryption.generate_vault_key()
        encrypted = VaultEncryption.encrypt_vault_key(vault_key, derived)
        VaultConfig.objects.create(
            owner=self.member,
            salt=base64.b64encode(salt).decode(),
            encrypted_vault_key=encrypted,
        )

    def test_get_not_configured(self):
        url = reverse("vault-preferences")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_configured_returns_default(self):
        self._setup_vault()
        url = reverse("vault-preferences")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("session_ttl_minutes", resp.data)

    def test_patch_not_configured(self):
        url = reverse("vault-preferences")
        resp = self.client.patch(url, {"session_ttl_minutes": 30})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_missing_field(self):
        self._setup_vault()
        url = reverse("vault-preferences")
        resp = self.client.patch(url, {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_non_integer_value(self):
        self._setup_vault()
        url = reverse("vault-preferences")
        resp = self.client.patch(url, {"session_ttl_minutes": "abc"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_out_of_range(self):
        self._setup_vault()
        url = reverse("vault-preferences")
        resp = self.client.patch(url, {"session_ttl_minutes": 5})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        resp = self.client.patch(url, {"session_ttl_minutes": 999})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_success(self):
        self._setup_vault()
        url = reverse("vault-preferences")
        resp = self.client.patch(url, {"session_ttl_minutes": 120})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["session_ttl_minutes"], 120)
        vc = VaultConfig.objects.get(owner=self.member)
        self.assertEqual(vc.session_ttl_minutes, 120)
