from django.contrib.auth.models import User
from django.db import models

from app.encryption import DecryptionError, FieldEncryption
from app.models import BaseModel

CATEGORY_CHOICES = (
    ("llm", "LLM / Agentes"),
    ("email", "Email"),
    ("backup", "Backup"),
    ("app", "Aplicação"),
    ("security", "Segurança"),
    ("storage", "Armazenamento (MinIO)"),
)


class SystemConfig(models.Model):
    """
    Configurações do sistema editáveis pelo admin via UI.
    Secrets são armazenados criptografados com a ENCRYPTION_KEY do projeto.
    Alterações são auditadas via updated_by/updated_at.
    """

    key = models.CharField(max_length=100, unique=True, verbose_name="Chave")
    _value = models.TextField(
        null=True, blank=True, verbose_name="Valor (criptografado se secret)"
    )
    is_secret = models.BooleanField(default=False, verbose_name="É secreto")
    category = models.CharField(
        max_length=50, choices=CATEGORY_CHOICES, verbose_name="Categoria"
    )
    label = models.CharField(max_length=200, verbose_name="Label")
    description = models.TextField(blank=True, verbose_name="Descrição")
    requires_restart = models.BooleanField(
        default=False, verbose_name="Requer reinicialização"
    )
    is_editable = models.BooleanField(default=True, verbose_name="Editável")
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="Atualizado em"
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Atualizado por",
    )

    class Meta:
        verbose_name = "Configuração do Sistema"
        verbose_name_plural = "Configurações do Sistema"
        ordering = ["category", "key"]

    def __str__(self) -> str:
        return f"{self.category}.{self.key}"

    def get_value(self) -> str | None:
        if not self._value:
            return None
        if self.is_secret:
            try:
                return FieldEncryption.decrypt_data(self._value)
            except (DecryptionError, Exception):
                return None
        return self._value

    def set_value(self, value: str | None) -> None:
        if value is None or value == "":
            self._value = None
        elif self.is_secret:
            self._value = FieldEncryption.encrypt_data(str(value))
        else:
            self._value = str(value)

    @property
    def masked_value(self) -> str | None:
        if not self._value:
            return None
        if self.is_secret:
            return "••••••••"
        return self._value

    @property
    def is_configured(self) -> bool:
        return bool(self._value)


class UserScreenAccess(BaseModel):
    """Ações que um usuário comum tem em uma tela (chaves de
    `admin_panel.screens.SCREENS`). Ausência de linha = sem acesso."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="screen_accesses",
        verbose_name="Usuário",
    )
    screen = models.CharField(max_length=64, verbose_name="Tela")
    actions = models.JSONField(default=list, verbose_name="Ações")

    class Meta:
        verbose_name = "Acesso a tela"
        verbose_name_plural = "Acessos a telas"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "screen"], name="unique_user_screen_access"
            )
        ]

    def __str__(self) -> str:
        return f"{self.user}:{self.screen}"


class ScreenDefault(BaseModel):
    """Ações concedidas a cada novo usuário comum ao se cadastrar."""

    screen = models.CharField(max_length=64, unique=True, verbose_name="Tela")
    actions = models.JSONField(default=list, verbose_name="Ações")

    class Meta:
        verbose_name = "Padrão de tela"
        verbose_name_plural = "Padrões de telas"

    def __str__(self) -> str:
        return self.screen
