"""
Vault Crypto — criptografia por usuário para o cofre de segurança.

Implementa envelope encryption:
  master_password + salt → PBKDF2-HMAC-SHA256 → derived_key
  vault_key (Fernet aleatório) → cifrado com derived_key → armazenado no DB
  dados sensíveis → cifrados com vault_key

A senha mestre nunca é armazenada.
A vault_key em texto plano fica apenas em memória (Redis, TTL = 1h).
"""

import base64
import os
from typing import Any, Callable, Optional, overload

from rest_framework.exceptions import APIException

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.encryption import (
    DecryptionError,
    EncryptionError,
    FieldEncryption,
    get_current_vault_key,
)

# ---------------------------------------------------------------------------
# Exception
# ---------------------------------------------------------------------------


class VaultLockedException(APIException):
    """Retornado quando o cofre está configurado mas não desbloqueado."""

    status_code = 423
    default_detail = "O cofre está bloqueado. Digite a senha mestre para desbloquear."
    default_code = "vault_locked"


# ---------------------------------------------------------------------------
# VaultEncryption — operações de chave
# ---------------------------------------------------------------------------


class VaultEncryption:
    """Utilitários de criptografia para o cofre por usuário."""

    ITERATIONS = 480_000

    @staticmethod
    def generate_salt() -> bytes:
        """Gera um salt aleatório de 32 bytes."""
        return os.urandom(32)

    @staticmethod
    def derive_key(master_password: str, salt: bytes) -> bytes:
        """
        Deriva uma chave Fernet a partir da senha mestre e do salt.
        Usa PBKDF2-HMAC-SHA256 com 480.000 iterações.

        Returns:
            bytes: Chave Fernet de 32 bytes (base64url-safe)
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=VaultEncryption.ITERATIONS,
        )
        return base64.urlsafe_b64encode(kdf.derive(master_password.encode("utf-8")))

    @staticmethod
    def generate_vault_key() -> bytes:
        """Gera uma chave Fernet aleatória para o cofre."""
        return Fernet.generate_key()

    @staticmethod
    def encrypt_vault_key(vault_key: bytes, derived_key: bytes) -> str:
        """Cifra a vault_key com a derived_key (envelope encryption)."""
        f = Fernet(derived_key)
        return f.encrypt(vault_key).decode()

    @staticmethod
    def decrypt_vault_key(encrypted_vault_key: str, derived_key: bytes) -> bytes:
        """
        Decifra a vault_key com a derived_key.

        Raises:
            DecryptionError: Se a senha mestre estiver incorreta.
        """
        try:
            f = Fernet(derived_key)
            return f.decrypt(encrypted_vault_key.encode())
        except InvalidToken:
            raise DecryptionError("Senha mestre incorreta")


# ---------------------------------------------------------------------------
# VaultEncryptedField descriptor
# ---------------------------------------------------------------------------


class VaultEncryptedField:
    """
    Descriptor para campos criptografados de itens do cofre de segurança.

    Comportamento:
    - __set__: usa vault_key do contexto de thread se disponível, senão usa app key
    - __get__: tenta vault_key primeiro; se falhar ou não disponível, tenta app key
                (compatibilidade retroativa durante migração de dados)

    Uso no modelo:
        _password = models.TextField()
        password = VaultEncryptedField('_password')
    """

    def __init__(
        self,
        storage_attr: str,
        validator: Optional[Callable[[str], None]] = None,
        preprocessor: Optional[Callable[[Any], str]] = None,
    ) -> None:
        self.storage_attr = storage_attr
        self.validator = validator
        self.preprocessor = preprocessor
        self.public_name = ""

    def __set_name__(self, owner: type, name: str) -> None:
        self.public_name = name

    @overload
    def __get__(self, obj: None, objtype: Any) -> "VaultEncryptedField": ...

    @overload
    def __get__(self, obj: Any, objtype: Any) -> Optional[str]: ...

    def __get__(
        self, obj: Any, objtype: Any = None
    ) -> "VaultEncryptedField | Optional[str]":
        if obj is None:
            return self
        raw: Optional[str] = getattr(obj, self.storage_attr)
        if not raw:
            return None

        vault_key = get_current_vault_key()
        if vault_key:
            try:
                return FieldEncryption.decrypt_with_key(raw, vault_key)
            except (DecryptionError, EncryptionError, Exception):
                pass  # Dado cifrado com app key (antes da configuração do cofre)

        try:
            return FieldEncryption.decrypt_data(raw)
        except (DecryptionError, Exception):
            return None

    def __set__(self, obj: Any, value: Any) -> None:
        if value:
            v: str = self.preprocessor(value) if self.preprocessor else str(value)
            if self.validator is not None:
                self.validator(v)
            vault_key = get_current_vault_key()
            if vault_key:
                setattr(
                    obj,
                    self.storage_attr,
                    FieldEncryption.encrypt_with_key(v, vault_key),
                )
            else:
                setattr(obj, self.storage_attr, FieldEncryption.encrypt_data(v))
        else:
            setattr(obj, self.storage_attr, None)


# ---------------------------------------------------------------------------
# VaultMaskedEncryptedField descriptor
# ---------------------------------------------------------------------------


class VaultMaskedEncryptedField:
    """
    Descriptor somente-leitura que retorna versão mascarada (****1234) de um
    campo criptografado do cofre de segurança.

    Idêntico a MaskedEncryptedField, mas usa vault_key do contexto se disponível.
    """

    def __init__(self, storage_attr: str, fallback: Optional[str] = None) -> None:
        self.storage_attr = storage_attr
        self.fallback = fallback
        self.public_name = ""

    def __set_name__(self, owner: type, name: str) -> None:
        self.public_name = name

    @overload
    def __get__(self, obj: None, objtype: Any) -> "VaultMaskedEncryptedField": ...

    @overload
    def __get__(self, obj: Any, objtype: Any) -> Optional[str]: ...

    def __get__(
        self, obj: Any, objtype: Any = None
    ) -> "VaultMaskedEncryptedField | Optional[str]":
        if obj is None:
            return self
        raw: Optional[str] = getattr(obj, self.storage_attr)
        if not raw:
            return self.fallback

        full: Optional[str] = None

        vault_key = get_current_vault_key()
        if vault_key:
            try:
                full = FieldEncryption.decrypt_with_key(raw, vault_key)
            except (DecryptionError, EncryptionError, Exception):
                pass

        if full is None:
            try:
                full = FieldEncryption.decrypt_data(raw)
            except (DecryptionError, Exception):
                return self.fallback

        if full and len(full) >= 4:
            return "*" * (len(full) - 4) + full[-4:]
        return full

    def __set__(self, obj: Any, value: Any) -> None:
        raise AttributeError(
            f"'{type(obj).__name__}.{self.public_name}' is a read-only masked field"
        )
