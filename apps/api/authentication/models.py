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


class ThemePreference(BaseModel):
    """
    Tema preferido do usuário, sincronizado a partir do desktop
    (theme_switcher.sh do repo de dotfiles). O token de sync só permite trocar
    o tema — nunca autentica o usuário no resto da API. Só o hash é armazenado.
    """

    THEMES = (
        # dark
        "dracula",
        "catppuccin-mocha",
        "tokyo-night",
        "gruvbox-dark",
        "cyberpunk",
        "flat-remix-blue-darkest",
        "everforest",
        "ubuntu",
        "mint-dark",
        # light
        "alucard",
        "catppuccin-latte",
        "rose-pine-dawn",
        "everforest-light",
        "gruvbox-light",
        "solarized-light",
        "nord-light",
        "ubuntu-light",
        "mint-light",
    )

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="theme_preference",
        verbose_name="Usuário",
    )
    theme = models.CharField(
        max_length=32,
        blank=True,
        choices=[(t, t) for t in THEMES],
        verbose_name="Tema",
    )
    sync_token_hash = models.CharField(
        max_length=64,
        blank=True,
        db_index=True,
        verbose_name="Hash do token de sync",
    )

    class Meta:
        verbose_name = "Preferência de tema"
        verbose_name_plural = "Preferências de tema"

    def __str__(self) -> str:
        return f"ThemePreference({self.user.username}, {self.theme or '-'})"

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    def issue_sync_token(self) -> str:
        """Gera um novo token (invalida o anterior) e retorna o plaintext."""
        token = secrets.token_hex(32)
        self.sync_token_hash = self.hash_token(token)
        self.save(update_fields=["sync_token_hash", "updated_at"])
        return token
