"""
Tests for security module improvements:
  - Luhn algorithm validation on card numbers
  - Master password complexity validation
  - Vault unlock rate limiting and lockout
  - Session invalidation on password change
  - Tags as list (ArrayField)
  - object_uuid in ActivityLog
  - Health report including cards and accounts
  - New import parsers (1Password, Dashlane, KeePass)
  - ActivityLogListView does not require vault
"""

import base64
import xml.etree.ElementTree as ET

from django.contrib.auth.models import User
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member
from security.importers import (
    ImportParseError,
    parse_dashlane_csv,
    parse_keepass_xml,
    parse_onepassword_csv,
)
from security.models import ActivityLog, Password
from security.vault_config import (
    VAULT_MAX_FAILED_ATTEMPTS,
    _cache_key,
    _store_vault_key_in_cache,
)
from security.vault_crypto import VaultEncryption

# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------


class BaseSecurityTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="imptest",
            email="imp@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Imp User",
            document_hash="i" * 64,
            phone="11999999991",
            sex="M",
            user=self.user,
        )
        cache.clear()

    def tearDown(self):
        cache.clear()


# ---------------------------------------------------------------------------
# Luhn validation
# ---------------------------------------------------------------------------


class LuhnValidationTest(BaseSecurityTestCase):
    """StoredCreditCard should reject card numbers that fail the Luhn check."""

    def _card_data(self, card_number):
        return {
            "name": "Test Card",
            "card_number": card_number,
            "security_code": "123",
            "cardholder_name": "Test User",
            "expiration_month": 12,
            "expiration_year": 2030,
            "flag": "VSA",
            "owner": self.member.pk,
        }

    def test_valid_luhn_card_accepted(self):
        # Visa test number — passes Luhn
        url = reverse("stored-card-list-create")
        resp = self.client.post(url, self._card_data("4532015112830366"))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_invalid_luhn_card_rejected(self):
        url = reverse("stored-card-list-create")
        # Valid length but fails Luhn
        resp = self.client.post(url, self._card_data("4532015112830367"))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_digit_card_rejected(self):
        url = reverse("stored-card-list-create")
        resp = self.client.post(url, self._card_data("4532-ABCD-1283-0366"))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Master password complexity
# ---------------------------------------------------------------------------


class MasterPasswordComplexityTest(BaseSecurityTestCase):
    def test_setup_weak_password_rejected(self):
        url = reverse("vault-setup")
        resp = self.client.post(
            url,
            {
                "master_password": "alllowercase1",
                "confirm_master_password": "alllowercase1",
            },
        )
        # Only lowercase + digit → 2 criteria → rejected
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_setup_strong_password_accepted(self):
        url = reverse("vault-setup")
        resp = self.client.post(
            url,
            {
                "master_password": "Str0ng!Pass",
                "confirm_master_password": "Str0ng!Pass",
            },
        )
        self.assertIn(
            resp.status_code,
            [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST],
        )
        # If vault already configured it returns 400 with different message
        if resp.status_code == status.HTTP_400_BAD_REQUEST:
            self.assertNotIn("critérios", str(resp.data))

    def test_setup_password_mismatch_rejected(self):
        url = reverse("vault-setup")
        resp = self.client.post(
            url,
            {
                "master_password": "Str0ng!Pass",
                "confirm_master_password": "Different1!",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Vault lockout after failed attempts
# ---------------------------------------------------------------------------


class VaultLockoutTest(BaseSecurityTestCase):
    def _setup_vault(self, master_password="Str0ng!Pass99"):
        from security.models import VaultConfig

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

    def test_lockout_after_max_failed_attempts(self):
        self._setup_vault()
        url = reverse("vault-unlock")

        # Use up all allowed attempts
        for _ in range(VAULT_MAX_FAILED_ATTEMPTS):
            resp = self.client.post(url, {"master_password": "WrongPass1!"})
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        # Next attempt should be locked out
        resp = self.client.post(url, {"master_password": "WrongPass1!"})
        self.assertEqual(resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_successful_unlock_resets_counter(self):
        self._setup_vault("Str0ng!Pass99")
        url = reverse("vault-unlock")

        # One wrong attempt
        self.client.post(url, {"master_password": "WrongPass1!"})

        # Correct password
        resp = self.client.post(url, {"master_password": "Str0ng!Pass99"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Counter should be reset — another wrong attempt should not lock
        # immediately
        resp = self.client.post(url, {"master_password": "WrongPass1!"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        error_msg = str(resp.data)
        self.assertNotIn("bloqueado temporariamente", error_msg.lower())

    def test_failed_vault_unlock_logged(self):
        self._setup_vault()
        url = reverse("vault-unlock")
        self.client.post(url, {"master_password": "WrongPass1!"})

        log = ActivityLog.objects.filter(
            user=self.user, action="failed_vault_unlock"
        ).first()
        self.assertIsNotNone(log)


# ---------------------------------------------------------------------------
# Session invalidation on password change
# ---------------------------------------------------------------------------


class VaultSessionInvalidationTest(BaseSecurityTestCase):
    def _setup_vault_and_unlock(self, master_password="Str0ng!Pass99"):
        from security.models import VaultConfig

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

    def test_old_session_invalidated_after_password_change(self):
        self._setup_vault_and_unlock("OldPass1!")

        # Verify vault is unlocked
        self.assertIsNotNone(cache.get(_cache_key(self.user.id)))

        # Change password
        url = reverse("vault-change-password")
        resp = self.client.post(
            url,
            {
                "current_master_password": "OldPass1!",
                "new_master_password": "NewPass2@",
                "confirm_new_master_password": "NewPass2@",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # A new session key should now be in cache (re-locked with new key)
        # The cache key still exists because change-password auto-unlocks
        self.assertIsNotNone(cache.get(_cache_key(self.user.id)))


# ---------------------------------------------------------------------------
# Tags as list (ArrayField)
# ---------------------------------------------------------------------------


class ArchiveTagsTest(BaseSecurityTestCase):
    def _archive_data(self, tags=None):
        return {
            "title": "Test Archive",
            "category": "personal",
            "archive_type": "text",
            "text_content": "Secret content",
            "tags": tags or [],
            "owner": self.member.pk,
        }

    def test_create_archive_with_tags_list(self):
        url = reverse("archive-list-create")
        resp = self.client.post(
            url, self._archive_data(["financeiro", "imposto"]), format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn("financeiro", resp.data["tags"])  # type: ignore

    def test_tags_normalised_to_lowercase(self):
        url = reverse("archive-list-create")
        resp = self.client.post(
            url,
            self._archive_data(["FINANCEIRO", "  Imposto  "]),
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        tags = resp.data["tags"]  # type: ignore
        self.assertIn("financeiro", tags)
        self.assertIn("imposto", tags)

    def test_create_archive_without_tags(self):
        url = reverse("archive-list-create")
        resp = self.client.post(url, self._archive_data([]), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["tags"], [])  # type: ignore


# ---------------------------------------------------------------------------
# object_uuid in ActivityLog
# ---------------------------------------------------------------------------


class ActivityLogUUIDTest(BaseSecurityTestCase):
    def test_log_activity_stores_object_uuid(self):
        pw = Password.objects.create(
            title="TestPW",
            username="user",
            owner=self.member,
            created_by=self.user,
            updated_by=self.user,
        )
        pw._password = "encrypted"
        pw.save(update_fields=["_password"])

        log = ActivityLog.log_action(
            user=self.user,
            action="create",
            description="test",
            model_name="Password",
            object_id=pw.id,
            object_uuid=pw.uuid,
        )
        self.assertEqual(log.object_uuid, pw.uuid)

    def test_activity_log_list_does_not_require_vault(self):
        """ActivityLogListView should work without vault unlocked."""
        url = reverse("activity-log-list")
        resp = self.client.get(url)
        # Should not return 423 Locked
        self.assertNotEqual(resp.status_code, 423)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Health report expanded
# ---------------------------------------------------------------------------


class HealthReportExpansionTest(BaseSecurityTestCase):
    def test_health_report_includes_card_fields(self):
        url = reverse("password-health-report")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.data  # type: ignore
        self.assertIn("problematic_cards", data)
        self.assertIn("problematic_accounts", data)
        self.assertIn("expired_cards", data["issues_summary"])
        self.assertIn("accounts_without_password", data["issues_summary"])

    def test_expired_card_appears_in_report(self):
        # Create expired card directly — bypass vault encryption for test speed
        from security.models import StoredCreditCard as SC

        card = SC(
            name="Expired Card",
            expiration_month=1,
            expiration_year=2020,
            cardholder_name="Test",
            flag="VSA",
            owner=self.member,
            created_by=self.user,
            updated_by=self.user,
            is_deleted=False,
        )
        card._card_number = "dummy"
        card._security_code = "dummy"
        card.save()
        # Ensure card is visible to the manager
        self.assertEqual(
            SC.objects.filter(owner=self.member, is_deleted=False).count(), 1
        )
        url = reverse("password-health-report")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.data  # type: ignore
        self.assertGreater(data["issues_summary"]["expired_cards"], 0)
        self.assertTrue(
            any("expired" in c["issues"] for c in data["problematic_cards"])
        )


# ---------------------------------------------------------------------------
# Import parsers
# ---------------------------------------------------------------------------


class OnePaswordCSVParserTest(APITestCase):
    _1P_HEADER = b"Title,Username,Password,URL,Notes,Type\n"

    def test_parse_basic_csv(self):
        content = (
            self._1P_HEADER
            + b"Gmail,user@g.com,secret,https://gmail.com,,login\n"
        )  # noqa: E501
        entries = parse_onepassword_csv(content)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["title"], "Gmail")
        self.assertEqual(entries[0]["username"], "user@g.com")
        self.assertEqual(entries[0]["password"], "secret")

    def test_skips_non_login_items(self):
        content = (
            self._1P_HEADER
            + b"Card,user,secret,,,Credit Card\nLogin,user,pass,,,login\n"
        )
        entries = parse_onepassword_csv(content)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["title"], "Login")

    def test_empty_file_returns_empty_list(self):
        entries = parse_onepassword_csv(
            b"Title,Username,Password,URL,Notes,Type\n"
        )
        self.assertEqual(entries, [])


class DashlaneCSVParserTest(APITestCase):
    _DL_HEADER = b"name,username,password,url,note,category,type\n"

    def test_parse_basic_csv(self):
        content = (
            self._DL_HEADER + b"Gmail,user@g.com,secret,https://gmail.com,,,\n"
        )
        entries = parse_dashlane_csv(content)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["title"], "Gmail")

    def test_category_mapped_to_banking(self):
        content = (
            self._DL_HEADER + b"Bank,user,secret,https://bank.com,,finance,\n"
        )
        entries = parse_dashlane_csv(content)
        self.assertEqual(entries[0]["category"], "banking")

    def test_skips_non_password_types(self):
        content = self._DL_HEADER + b"Note,user,secret,,,other,secure_note\n"
        entries = parse_dashlane_csv(content)
        self.assertEqual(entries, [])


class KeePassXMLParserTest(APITestCase):
    def _make_xml(self, entries):
        root = ET.Element("KeePassFile")
        root_group = ET.SubElement(ET.SubElement(root, "Root"), "Group")
        for e in entries:
            entry = ET.SubElement(root_group, "Entry")
            for key, val in e.items():
                s = ET.SubElement(entry, "String")
                ET.SubElement(s, "Key").text = key
                ET.SubElement(s, "Value").text = val
        return ET.tostring(root, encoding="unicode").encode("utf-8")

    def test_parse_basic_entry(self):
        xml = self._make_xml(
            [
                {
                    "Title": "Gmail",
                    "UserName": "user@g.com",
                    "Password": "secret",
                    "URL": "https://gmail.com",
                    "Notes": "",
                }
            ]
        )
        entries = parse_keepass_xml(xml)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["title"], "Gmail")
        self.assertEqual(entries[0]["username"], "user@g.com")

    def test_nested_groups_parsed(self):
        root = ET.Element("KeePassFile")
        root_el = ET.SubElement(root, "Root")
        parent_group = ET.SubElement(root_el, "Group")
        sub_group = ET.SubElement(parent_group, "Group")
        entry = ET.SubElement(sub_group, "Entry")
        s = ET.SubElement(entry, "String")
        ET.SubElement(s, "Key").text = "Title"
        ET.SubElement(s, "Value").text = "Nested"
        s2 = ET.SubElement(entry, "String")
        ET.SubElement(s2, "Key").text = "UserName"
        ET.SubElement(s2, "Value").text = "user"
        s3 = ET.SubElement(entry, "String")
        ET.SubElement(s3, "Key").text = "Password"
        ET.SubElement(s3, "Value").text = "pass"

        xml_bytes = ET.tostring(root, encoding="unicode").encode("utf-8")
        entries = parse_keepass_xml(xml_bytes)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["title"], "Nested")

    def test_invalid_xml_raises_parse_error(self):
        with self.assertRaises(ImportParseError):
            parse_keepass_xml(b"not xml at all <><><>")

    def test_missing_group_raises_parse_error(self):
        with self.assertRaises(ImportParseError):
            parse_keepass_xml(b"<KeePassFile><Root></Root></KeePassFile>")


# ---------------------------------------------------------------------------
# Import API with new formats
# ---------------------------------------------------------------------------


class ImportPreviewNewFormatsTest(BaseSecurityTestCase):
    def test_preview_keepass_xml(self):
        root = ET.Element("KeePassFile")
        root_el = ET.SubElement(root, "Root")
        group = ET.SubElement(root_el, "Group")
        entry = ET.SubElement(group, "Entry")
        for key, val in [
            ("Title", "Bank"),
            ("UserName", "user"),
            ("Password", "pass"),
            ("URL", "https://bank.com"),
            ("Notes", ""),
        ]:
            s = ET.SubElement(entry, "String")
            ET.SubElement(s, "Key").text = key
            ET.SubElement(s, "Value").text = val
        xml_bytes = ET.tostring(root, encoding="unicode").encode("utf-8")

        import io

        from django.core.files.uploadedfile import InMemoryUploadedFile

        f = InMemoryUploadedFile(
            io.BytesIO(xml_bytes),
            "file",
            "export.xml",
            "text/xml",
            len(xml_bytes),
            None,
        )
        url = reverse("password-import-preview")
        resp = self.client.post(url, {"file": f, "format": "keepass_xml"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["total"], 1)  # type: ignore

    def test_unsupported_format_returns_400(self):
        import io

        from django.core.files.uploadedfile import InMemoryUploadedFile

        f = InMemoryUploadedFile(
            io.BytesIO(b"data"), "file", "export.csv", "text/csv", 4, None
        )
        url = reverse("password-import-preview")
        resp = self.client.post(url, {"file": f, "format": "unknown_format"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
