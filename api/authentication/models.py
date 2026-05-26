import hashlib
import secrets

from django.contrib.auth.models import User
from django.db import models

import pyotp

from app.models import BaseModel


class TOTPDevice(BaseModel):
    """
    Armazena o secret TOTP de um usuário para autenticação de dois fatores.
    Um usuário pode ter apenas um device ativo (OneToOneField).
    """

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="totp_device",
        verbose_name="Usuário",
    )
    secret = models.CharField(max_length=64, verbose_name="Secret TOTP")
    is_active = models.BooleanField(
        default=False,
        verbose_name="Ativo",
        help_text="False até o usuário confirmar o primeiro código.",
    )
    # Lista de hashes SHA-256 dos backup codes (plaintext nunca armazenado)
    backup_codes = models.JSONField(
        default=list, verbose_name="Backup codes (hashed)"
    )
    activated_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Ativado em"
    )

    class Meta:
        verbose_name = "TOTP Device"
        verbose_name_plural = "TOTP Devices"

    def __str__(self) -> str:
        return f"TOTPDevice({self.user.username}, active={self.is_active})"

    def generate_provisioning_uri(self, issuer: str = "Axiom") -> str:
        totp = pyotp.TOTP(self.secret)
        return totp.provisioning_uri(
            name=self.user.email or self.user.username,
            issuer_name=issuer,
        )

    def verify_token(self, token: str) -> bool:
        """Valida código TOTP com janela de ±30s de tolerância."""
        totp = pyotp.TOTP(self.secret)
        return totp.verify(token, valid_window=1)

    def verify_backup_code(self, code: str) -> bool:
        """Valida e consome um backup code (uso único)."""
        code_hash = hashlib.sha256(code.upper().encode()).hexdigest()
        if code_hash in self.backup_codes:
            self.backup_codes.remove(code_hash)
            self.save(update_fields=["backup_codes"])
            return True
        return False

    @staticmethod
    def generate_backup_codes() -> tuple[list[str], list[str]]:
        """Gera 8 backup codes. Retorna (plaintext_list, hashed_list)."""
        codes = [secrets.token_hex(5).upper() for _ in range(8)]
        hashed = [hashlib.sha256(c.encode()).hexdigest() for c in codes]
        return codes, hashed
