"""
Tests for the rotate_encryption_key management command.
"""

import os
from io import StringIO
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from cryptography.fernet import Fernet

from app.management.commands.rotate_encryption_key import (
    _decrypt,
    _encrypt,
    _hmac_sha256,
)

# ---------------------------------------------------------------------------
# Helper function unit tests
# ---------------------------------------------------------------------------


class HelperFunctionTest(TestCase):
    def setUp(self):
        self.key = Fernet.generate_key()

    def test_decrypt_returns_none_for_empty_string(self):
        result = _decrypt("", self.key)
        self.assertIsNone(result)

    def test_decrypt_returns_none_on_invalid_token(self):
        result = _decrypt("not_valid_fernet_token", self.key)
        self.assertIsNone(result)

    def test_encrypt_decrypt_roundtrip(self):
        plain = "hello world"
        encrypted = _encrypt(plain, self.key)
        decrypted = _decrypt(encrypted, self.key)
        self.assertEqual(decrypted, plain)

    def test_hmac_sha256_deterministic(self):
        result1 = _hmac_sha256("12345678901", "secret_key")
        result2 = _hmac_sha256("12345678901", "secret_key")
        self.assertEqual(result1, result2)

    def test_hmac_sha256_differs_for_different_keys(self):
        result1 = _hmac_sha256("doc", "key1")
        result2 = _hmac_sha256("doc", "key2")
        self.assertNotEqual(result1, result2)


# ---------------------------------------------------------------------------
# Command argument validation
# ---------------------------------------------------------------------------


class RotateEncryptionKeyValidationTest(TestCase):
    def setUp(self):
        self.old_key = Fernet.generate_key().decode()
        self.new_key = Fernet.generate_key().decode()

    def test_invalid_old_key_raises_command_error(self):
        with self.assertRaises(CommandError) as ctx:
            call_command(
                "rotate_encryption_key",
                old_key="not-a-valid-fernet-key",
                new_key=self.new_key,
            )
        self.assertIn("--old-key", str(ctx.exception))

    def test_invalid_new_key_raises_command_error(self):
        with self.assertRaises(CommandError) as ctx:
            call_command(
                "rotate_encryption_key",
                old_key=self.old_key,
                new_key="not-a-valid-fernet-key",
            )
        self.assertIn("--new-key", str(ctx.exception))

    def test_same_key_raises_command_error(self):
        with self.assertRaises(CommandError) as ctx:
            call_command(
                "rotate_encryption_key",
                old_key=self.old_key,
                new_key=self.old_key,
            )
        self.assertIn("identical", str(ctx.exception))


# ---------------------------------------------------------------------------
# Dry-run (no DB writes, no models with data)
# ---------------------------------------------------------------------------


class RotateEncryptionKeyDryRunEmptyTest(TestCase):
    def setUp(self):
        self.old_key = Fernet.generate_key().decode()
        self.new_key = Fernet.generate_key().decode()

    def test_dry_run_with_no_data_succeeds(self):
        out = StringIO()
        call_command(
            "rotate_encryption_key",
            old_key=self.old_key,
            new_key=self.new_key,
            dry_run=True,
            stdout=out,
        )
        output = out.getvalue()
        self.assertIn("DRY-RUN", output)
        self.assertIn("Rotation complete", output)

    def test_live_run_with_no_data_succeeds(self):
        out = StringIO()
        call_command(
            "rotate_encryption_key",
            old_key=self.old_key,
            new_key=self.new_key,
            stdout=out,
        )
        output = out.getvalue()
        self.assertIn("Rotation complete", output)
        self.assertIn("Next steps", output)
        self.assertIn(self.new_key, output)


# ---------------------------------------------------------------------------
# Rotation with actual encrypted Account data
# ---------------------------------------------------------------------------


class RotateEncryptionKeyWithAccountDataTest(TestCase):
    def setUp(self):
        self.old_key_str = Fernet.generate_key().decode()
        self.new_key_str = Fernet.generate_key().decode()
        self.user = User.objects.create_superuser(
            username="rotatetest",
            email="rotate@test.com",
            password="pass123",
        )

    def _create_account_with_old_key(self, account_number: str):
        from accounts.models import Account

        old_key = self.old_key_str.encode()
        encrypted = _encrypt(account_number, old_key)

        # Create account without triggering encryption logic (no save()
        # override)
        account = Account.objects.create(
            account_name="Test Bank",
            institution_name="CEF",
            account_type="CC",
            current_balance=0,
            created_by=self.user,
        )
        # Directly inject the old-key-encrypted value at DB level
        Account.objects.filter(pk=account.pk).update(_account_number=encrypted)
        account.refresh_from_db()
        return account

    def test_rotates_account_number_field(self):
        account = self._create_account_with_old_key("12345678")
        old_encrypted = account._account_number

        out = StringIO()
        call_command(
            "rotate_encryption_key",
            old_key=self.old_key_str,
            new_key=self.new_key_str,
            stdout=out,
        )

        account.refresh_from_db()
        new_encrypted = account._account_number

        # Value should have changed
        self.assertNotEqual(old_encrypted, new_encrypted)

        # Should decrypt correctly with new key
        decrypted = _decrypt(new_encrypted, self.new_key_str.encode())
        self.assertEqual(decrypted, "12345678")

    def test_dry_run_does_not_modify_account(self):
        account = self._create_account_with_old_key("87654321")
        old_encrypted = account._account_number

        out = StringIO()
        call_command(
            "rotate_encryption_key",
            old_key=self.old_key_str,
            new_key=self.new_key_str,
            dry_run=True,
            stdout=out,
        )

        account.refresh_from_db()
        # Field must remain unchanged after dry-run
        self.assertEqual(account._account_number, old_encrypted)

        output = out.getvalue()
        self.assertIn("DRY-RUN", output)


# ---------------------------------------------------------------------------
# Rotation with Member encrypted document
# ---------------------------------------------------------------------------


class RotateEncryptionKeyWithMemberDataTest(TestCase):
    def setUp(self):
        self.old_key_str = Fernet.generate_key().decode()
        self.new_key_str = Fernet.generate_key().decode()
        self.user = User.objects.create_superuser(
            username="memberrotate",
            email="memberrotate@test.com",
            password="pass123",
        )

    def _create_member_with_old_key(
        self, document: str, phone: str = "11999999999"
    ):
        """Create a Member with _document encrypted using the old key,"""
        """bypassing save()."""
        from members.models import Member

        old_key = self.old_key_str.encode()
        encrypted_doc = _encrypt(document, old_key)
        doc_hash = _hmac_sha256(document, self.old_key_str)

        # Use update_or_create at DB level to bypass the save() encryption
        # hook.
        # First create a valid member without document, then inject raw values.
        with patch.dict(os.environ, {"ENCRYPTION_KEY": self.old_key_str}):
            member = Member.objects.create(
                user=self.user,
                name="Test Member",
                phone=phone,
                sex="M",
                document_hash=doc_hash,
                _document=encrypted_doc,
                created_by=self.user,
            )
        return member

    def test_rotates_member_document_and_hash(self):
        member = self._create_member_with_old_key("12345678901")
        old_encrypted = member._document
        old_hash = member.document_hash

        out = StringIO()
        call_command(
            "rotate_encryption_key",
            old_key=self.old_key_str,
            new_key=self.new_key_str,
            stdout=out,
        )

        member.refresh_from_db()
        self.assertNotEqual(member._document, old_encrypted)
        self.assertNotEqual(member.document_hash, old_hash)

        # Verify decryptable with new key
        decrypted = _decrypt(member._document, self.new_key_str.encode())
        self.assertEqual(decrypted, "12345678901")

        # Verify HMAC recomputed correctly
        expected_hash = _hmac_sha256("12345678901", self.new_key_str)
        self.assertEqual(member.document_hash, expected_hash)

    def test_skips_member_with_undecryptable_document(self):
        """When old key cannot decrypt, member is skipped (not corrupted)."""
        from members.models import Member

        # Encrypt document with a completely different key (simulates a record
        # that cannot be decrypted with the provided old key)
        wrong_key = Fernet.generate_key()
        encrypted_with_wrong_key = _encrypt("12345678902", wrong_key)
        doc_hash = _hmac_sha256("12345678902", self.old_key_str)

        user2 = User.objects.create_superuser(
            username="memberrotate2",
            email="memberrotate2@test.com",
            password="pass123",
        )
        # Create without _document first (save() skips decrypt when _document
        # is falsy)
        member = Member.objects.create(
            user=user2,
            name="Skip Member",
            phone="11999999998",
            sex="M",
            document_hash=doc_hash,
            created_by=self.user,
        )
        # Inject the wrong-key-encrypted value at DB level, bypassing save()
        Member.objects.filter(pk=member.pk).update(
            _document=encrypted_with_wrong_key
        )
        member.refresh_from_db()
        original_document = member._document

        out = StringIO()
        call_command(
            "rotate_encryption_key",
            old_key=self.old_key_str,
            new_key=self.new_key_str,
            stdout=out,
        )

        member.refresh_from_db()
        # Document should remain unchanged since it couldn't be decrypted
        self.assertEqual(member._document, original_document)
        output = out.getvalue()
        self.assertIn("SKIP", output)


# ---------------------------------------------------------------------------
# Rotation with vault items (best_effort=True, silently skips undecryptable)
# ---------------------------------------------------------------------------


class RotateEncryptionKeyVaultItemsTest(TestCase):
    """Vault items encrypted with vault key are silently skipped."""

    def setUp(self):
        self.old_key_str = Fernet.generate_key().decode()
        self.new_key_str = Fernet.generate_key().decode()
        self.user = User.objects.create_superuser(
            username="vaultrotate",
            email="vaultrotate@test.com",
            password="pass123",
        )

    def test_vault_items_not_decryptable_are_silently_skipped(self):
        """
        Items encrypted with a different key (simulating vault-key-encrypted)
        should be counted as skipped without error (best_effort=True).
        """
        from members.models import Member
        from security.models import Password

        # Create the member owner required by Password
        member = Member.objects.create(
            user=self.user,
            name="Vault Owner",
            phone="11999999990",
            sex="M",
            document_hash="vaultownerhash001",
            created_by=self.user,
        )

        vault_key = Fernet.generate_key()
        # Encrypt password with vault key (not the old app key)
        vault_encrypted = _encrypt("supersecret", vault_key)

        # _password is required; provide placeholder so create() succeeds,
        # then overwrite at DB level with the vault-key-encrypted value.
        password = Password.objects.create(
            title="Test Password",
            username="user@example.com",
            site="https://example.com",
            _password=vault_encrypted,
            owner=member,
            created_by=self.user,
        )
        Password.objects.filter(pk=password.pk).update(
            _password=vault_encrypted
        )
        password.refresh_from_db()
        original_password = password._password

        out = StringIO()
        call_command(
            "rotate_encryption_key",
            old_key=self.old_key_str,
            new_key=self.new_key_str,
            stdout=out,
        )

        output = out.getvalue()
        # Should complete successfully (best_effort skips silently)
        self.assertIn("Rotation complete", output)

        password.refresh_from_db()
        # Password field should remain unchanged (vault-key-encrypted, skipped)
        self.assertEqual(password._password, original_password)
