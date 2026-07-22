"""
Tests that VaultEncryptedField emits a warning when vault-key decryption fails
and it falls back to app-key decryption.
"""

import logging

from django.test import TestCase

from cryptography.fernet import Fernet

from app.encryption import FieldEncryption
from security.vault_crypto import (
    VaultEncryptedField,
    clear_vault_key,
    set_vault_key,
)


class _FakeModel:
    """Minimal stand-in for a Django model instance."""

    # Descriptor reads from '_raw'; the public name is 'secret'
    secret = VaultEncryptedField("_raw")

    def __init__(self, raw_value: str):
        # '_raw' is a plain attribute, not a descriptor — no recursion
        self._raw = raw_value


class VaultEncryptedFieldFallbackWarningTest(TestCase):
    def tearDown(self):
        clear_vault_key()

    def test_warning_emitted_on_vault_key_fallback(self):
        """
        Warning must be logged when vault-key decryption fails and app-key is
        used.
        """
        # Encrypt a value with the app key (simulates legacy data or data
        # encrypted
        # before the vault was configured for the user)
        plaintext = "super-secret-value"
        app_key_ciphertext = FieldEncryption.encrypt_data(plaintext)

        # Put a *different* vault key in the thread-local context so that
        # decrypt_with_key raises DecryptionError, triggering the fallback
        # path.
        unrelated_vault_key = Fernet.generate_key()
        set_vault_key(unrelated_vault_key)

        instance = _FakeModel(app_key_ciphertext)

        with self.assertLogs(
            "security.vault_crypto", level=logging.WARNING
        ) as cm:
            result = instance.secret

        self.assertEqual(result, plaintext)
        self.assertTrue(
            any(
                "_FakeModel" in line and "secret" in line for line in cm.output
            ),
            msg=f"Expected model and field name in warning. Got: {cm.output}",
        )
