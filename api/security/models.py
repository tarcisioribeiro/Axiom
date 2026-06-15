import uuid as _uuid

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from app.models import BaseModel
from security.vault_crypto import (
    VaultEncryptedField,
    VaultMaskedEncryptedField,
)

# ============================================================================
# PASSWORD MODEL
# ============================================================================

PASSWORD_CATEGORIES = (
    ("social", "Redes Sociais"),
    ("email", "E-mail"),
    ("banking", "Bancário"),
    ("work", "Trabalho"),
    ("entertainment", "Entretenimento"),
    ("shopping", "Compras"),
    ("streaming", "Streaming"),
    ("gaming", "Games"),
    ("other", "Outro"),
)


class Password(BaseModel):
    """
    Modelo para armazenamento seguro de senhas.
    Todas as senhas são criptografadas usando a vault_key do usuário (Fernet).
    """

    title = models.CharField(max_length=200, verbose_name="Título")
    site = models.URLField(
        max_length=500, verbose_name="Site", blank=True, null=True
    )
    username = models.CharField(max_length=200, verbose_name="Usuário/Email")
    _password = models.TextField(verbose_name="Senha (Criptografada)")
    category = models.CharField(
        max_length=100, choices=PASSWORD_CATEGORIES, default="other"
    )
    notes = models.TextField(blank=True, null=True, verbose_name="Observações")
    last_password_change = models.DateTimeField(auto_now_add=True)
    is_favorite = models.BooleanField(default=False, verbose_name="Favorito")
    owner = models.ForeignKey(
        "members.Member", on_delete=models.PROTECT, related_name="passwords"
    )
    totp_enabled = models.BooleanField(
        default=False, verbose_name="TOTP Habilitado"
    )
    _totp_secret = models.TextField(
        blank=True, null=True, verbose_name="Segredo TOTP (Criptografado)"
    )
    hibp_compromised = models.BooleanField(
        null=True, blank=True, verbose_name="Comprometida (HIBP)"
    )
    hibp_last_checked = models.DateTimeField(
        null=True, blank=True, verbose_name="Última verificação HIBP"
    )
    strength_score = models.IntegerField(
        default=0,
        verbose_name="Força da Senha (0-4)",
        help_text="0=Muito Fraca, 1=Fraca, 2=Razoável, 3=Boa, 4=Forte",
    )

    password = VaultEncryptedField("_password")
    totp_secret = VaultEncryptedField("_totp_secret")

    @staticmethod
    def calculate_strength(password_text: str) -> int:
        score = 0
        if len(password_text) >= 8:
            score += 1
        if len(password_text) >= 12:
            score += 1
        has_upper = any(c.isupper() for c in password_text)
        has_lower = any(c.islower() for c in password_text)
        if has_upper and has_lower:
            score += 1
        if any(c.isdigit() for c in password_text):
            score += 1
        if any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?/~`" for c in password_text):
            score += 1
        return min(4, score)

    class Meta:
        verbose_name = "Senha"
        verbose_name_plural = "Senhas"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} - {self.username}"


# ============================================================================
# STORED CREDIT CARD MODEL
# ============================================================================

FLAGS = (
    ("MSC", "Mastercard"),
    ("VSA", "Visa"),
    ("ELO", "Elo"),
    ("EXP", "American Express"),
    ("HCD", "Hipercard"),
    ("DIN", "Diners Club"),
    ("OTHER", "Outro"),
)


def _normalize_card_number(value: object) -> str:
    return str(value).replace(" ", "").replace("-", "")


def _luhn_check(number: str) -> bool:
    """Validates a card number string using the Luhn algorithm."""
    digits = [int(d) for d in reversed(number)]
    total = sum(
        d if i % 2 == 0 else (d * 2 - 9 if d * 2 > 9 else d * 2)
        for i, d in enumerate(digits)
    )
    return total % 10 == 0


def _validate_card_number(value: str) -> None:
    if not value.isdigit() or len(value) < 13 or len(value) > 19:
        raise ValidationError("Número do cartão inválido.")
    if not _luhn_check(value):
        raise ValidationError(
            "Número do cartão inválido (dígito verificador incorreto)."
        )


def _validate_cvv(value: str) -> None:
    if not value.isdigit() or len(value) not in [3, 4]:
        raise ValidationError("CVV inválido.")


class StoredCreditCard(BaseModel):
    """Armazenamento seguro de credenciais de cartões de crédito."""

    name = models.CharField(max_length=200, verbose_name="Nome do Cartão")
    _card_number = models.TextField(
        verbose_name="Número do Cartão (Criptografado)"
    )
    _security_code = models.TextField(verbose_name="CVV (Criptografado)")
    expiration_month = models.IntegerField(verbose_name="Mês de Validade")
    expiration_year = models.IntegerField(verbose_name="Ano de Validade")
    cardholder_name = models.CharField(
        max_length=200, verbose_name="Nome do Titular"
    )
    flag = models.CharField(
        max_length=50, choices=FLAGS, verbose_name="Bandeira"
    )
    notes = models.TextField(blank=True, null=True, verbose_name="Observações")
    is_favorite = models.BooleanField(default=False, verbose_name="Favorito")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="stored_credit_cards",
    )
    finance_card = models.ForeignKey(
        "credit_cards.CreditCard",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stored_credentials",
    )

    card_number = VaultEncryptedField(
        "_card_number",
        preprocessor=_normalize_card_number,
        validator=_validate_card_number,
    )
    card_number_masked = VaultMaskedEncryptedField("_card_number")
    security_code = VaultEncryptedField(
        "_security_code",
        preprocessor=lambda v: str(v).strip(),
        validator=_validate_cvv,
    )

    class Meta:
        verbose_name = "Cartão Armazenado"
        verbose_name_plural = "Cartões Armazenados"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} - {self.flag} ({self.card_number_masked})"


# ============================================================================
# STORED BANK ACCOUNT MODEL
# ============================================================================

ACCOUNT_TYPES = (
    ("CC", "Conta Corrente"),
    ("CS", "Conta Salário"),
    ("CP", "Conta Poupança"),
    ("CI", "Conta Investimento"),
    ("OTHER", "Outro"),
)


class StoredBankAccount(BaseModel):
    """Armazenamento seguro de credenciais de contas bancárias."""

    name = models.CharField(max_length=200, verbose_name="Nome da Conta")
    institution_name = models.CharField(
        max_length=200, verbose_name="Instituição Financeira"
    )
    institution_code = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        verbose_name="Código ISPB/COMPE",
    )
    account_type = models.CharField(max_length=50, choices=ACCOUNT_TYPES)
    _account_number = models.TextField(
        verbose_name="Número da Conta (Criptografado)"
    )
    agency = models.CharField(max_length=10, blank=True, null=True)
    _password = models.TextField(
        verbose_name="Senha Bancária (Criptografada)", blank=True, null=True
    )
    _digital_password = models.TextField(
        verbose_name="Senha Digital (Criptografada)", blank=True, null=True
    )
    notes = models.TextField(blank=True, null=True)
    is_favorite = models.BooleanField(default=False, verbose_name="Favorito")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="stored_bank_accounts",
    )
    finance_account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stored_credentials",
    )

    account_number = VaultEncryptedField("_account_number")
    account_number_masked = VaultMaskedEncryptedField("_account_number")
    password = VaultEncryptedField("_password")
    digital_password = VaultEncryptedField("_digital_password")

    class Meta:
        verbose_name = "Conta Bancária Armazenada"
        verbose_name_plural = "Contas Bancárias Armazenadas"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} - {self.institution_name}"


# ============================================================================
# ARCHIVE MODEL
# ============================================================================

ARCHIVE_TYPES = (
    ("text", "Texto"),
    ("pdf", "PDF"),
    ("image", "Imagem"),
    ("document", "Documento"),
    ("other", "Outro"),
)

ARCHIVE_CATEGORIES = (
    ("personal", "Pessoal"),
    ("financial", "Financeiro"),
    ("legal", "Jurídico"),
    ("medical", "Médico"),
    ("tax", "Impostos"),
    ("work", "Trabalho"),
    ("other", "Outro"),
)


class Archive(BaseModel):
    """Armazenamento seguro de arquivos confidenciais."""

    title = models.CharField(max_length=200, verbose_name="Título")
    category = models.CharField(
        max_length=100, choices=ARCHIVE_CATEGORIES, default="other"
    )
    archive_type = models.CharField(
        max_length=50, choices=ARCHIVE_TYPES, default="other"
    )
    _encrypted_text = models.TextField(
        blank=True, null=True, verbose_name="Texto Criptografado"
    )
    encrypted_file = models.FileField(
        upload_to="security/archives/%Y/%m/", blank=True, null=True
    )
    file_name = models.CharField(
        max_length=255, blank=True, null=True, verbose_name="Nome do Arquivo"
    )
    file_size = models.BigIntegerField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    is_favorite = models.BooleanField(default=False, verbose_name="Favorito")
    tags = models.JSONField(
        blank=True,
        default=list,
        verbose_name="Tags",
        help_text="Lista de tags para categorização e busca",
    )
    is_file_encrypted = models.BooleanField(
        default=False,
        verbose_name="Arquivo Criptografado",
        help_text=(
            "Indica se o arquivo foi criptografado com a vault_key do usuário"
        ),
    )
    owner = models.ForeignKey(
        "members.Member", on_delete=models.PROTECT, related_name="archives"
    )

    _text_content = VaultEncryptedField("_encrypted_text")

    @property
    def text_content(self):
        return self._text_content

    @text_content.setter
    def text_content(self, value):
        if value:
            self._text_content = str(value)
            self.file_size = len(str(value).encode("utf-8"))
        else:
            self._encrypted_text = None
            self.file_size = None

    def has_text_content(self):
        """Retorna True se o arquivo tem conteúdo de texto."""
        return bool(self._encrypted_text)

    def has_file_content(self):
        """Retorna True se o arquivo tem um arquivo carregado."""
        return bool(self.encrypted_file)

    class Meta:
        verbose_name = "Arquivo Confidencial"
        verbose_name_plural = "Arquivos Confidenciais"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} - {self.category}"


# ============================================================================
# VAULT CONFIG MODEL
# ============================================================================


class VaultConfig(models.Model):
    """
    Configuração do cofre de segurança por usuário.

    Armazena o salt e a vault_key cifrada com a derived_key
    (PBKDF2 da senha mestre).
    A senha mestre NUNCA é armazenada — apenas usada para derivar
    a chave temporária.
    A vault_key em texto plano fica apenas no Redis com TTL de 1 hora.
    """

    owner = models.OneToOneField(
        "members.Member",
        on_delete=models.CASCADE,
        related_name="vault_config",
        verbose_name="Proprietário",
    )
    # Salt aleatório de 32 bytes, armazenado em base64
    salt = models.CharField(max_length=100, verbose_name="Salt (base64)")
    # vault_key cifrada com derived_key(master_password, salt)
    encrypted_vault_key = models.TextField(
        verbose_name="Chave do Cofre (cifrada com senha mestre)"
    )
    # Recovery key: hash SHA-256 (plaintext nunca armazenado)
    recovery_key_hash = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        verbose_name="Hash da Chave de Recuperação (SHA-256)",
    )
    # vault_key cifrada com a chave de recuperação (envelope encryption)
    recovery_encrypted_vault_key = models.TextField(
        null=True,
        blank=True,
        verbose_name="Chave do Cofre (cifrada com chave de recuperação)",
    )
    # TTL da sessão do cofre em minutos (None = usar padrão global de 60 min)
    session_ttl_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="TTL da Sessão (minutos)",
        help_text="Tempo de sessão do cofre em minutos. Mín: 15, Máx: 240.",
    )
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Criado em"
    )
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="Atualizado em"
    )

    class Meta:
        verbose_name = "Configuração do Cofre"
        verbose_name_plural = "Configurações do Cofre"

    def __str__(self):
        return f"VaultConfig({self.owner})"


# ============================================================================
# CREDENTIAL SHARE TOKEN MODEL
# ============================================================================


class CredentialShareToken(models.Model):
    """
    Token temporário para compartilhar uma credencial com outro
    membro do sistema.

    Ao criar o token, a senha é decifrada com a vault_key e re-cifrada com a
    app key (snapshot). Assim o resgate não requer cofre desbloqueado.
    """

    CREDENTIAL_TYPE_CHOICES = (
        ("password", "Senha"),
        ("stored_credit_card", "Cartão de Crédito"),
        ("stored_bank_account", "Conta Bancária"),
    )
    credential_type = models.CharField(
        max_length=30,
        choices=CREDENTIAL_TYPE_CHOICES,
        default="password",
        verbose_name="Tipo de Credencial",
    )
    password = models.ForeignKey(
        "Password",
        on_delete=models.CASCADE,
        related_name="share_tokens",
        verbose_name="Senha",
        null=True,
        blank=True,
    )
    stored_credit_card = models.ForeignKey(
        "StoredCreditCard",
        on_delete=models.CASCADE,
        related_name="share_tokens",
        verbose_name="Cartão Armazenado",
        null=True,
        blank=True,
    )
    stored_bank_account = models.ForeignKey(
        "StoredBankAccount",
        on_delete=models.CASCADE,
        related_name="share_tokens",
        verbose_name="Conta Bancária Armazenada",
        null=True,
        blank=True,
    )
    token = models.UUIDField(
        default=_uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name="Token",
    )
    # Snapshot da credencial re-criptografado com a app key (não a vault_key).
    # Para senhas: string simples (compat. legada) ou JSON.
    # Para cartões/contas: JSON com todos os campos relevantes.
    _encrypted_password = models.TextField(
        verbose_name="Credencial (snapshot criptografado)"
    )
    expires_at = models.DateTimeField(verbose_name="Expira em")
    used_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Último uso em"
    )
    use_count = models.IntegerField(default=0, verbose_name="Usos realizados")
    max_uses = models.IntegerField(default=1, verbose_name="Máximo de usos")
    is_revoked = models.BooleanField(default=False, verbose_name="Revogado")
    allowed_ips = models.JSONField(
        default=list,
        blank=True,
        verbose_name="IPs Permitidos",
        help_text=(
            "Lista de IPs autorizados a usar este token. Vazia = qualquer IP."
        ),
    )
    created_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_share_tokens",
        verbose_name="Criado por",
    )
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Criado em"
    )

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_exhausted(self):
        return self.use_count >= self.max_uses

    @property
    def is_valid(self):
        return (
            not self.is_revoked
            and not self.is_expired
            and not self.is_exhausted
        )

    class Meta:
        verbose_name = "Token de Compartilhamento"
        verbose_name_plural = "Tokens de Compartilhamento"
        ordering = ["-created_at"]

    @property
    def credential_title(self):
        if (
            self.credential_type == "stored_credit_card"
            and self.stored_credit_card
        ):
            return self.stored_credit_card.name
        if (
            self.credential_type == "stored_bank_account"
            and self.stored_bank_account
        ):
            return self.stored_bank_account.name
        return self.password.title if self.password else "—"

    def __str__(self):
        return f"ShareToken({self.credential_title} | exp={self.expires_at})"


ACTION_TYPES = (
    ("view", "Visualização"),
    ("create", "Criação"),
    ("update", "Atualização"),
    ("delete", "Exclusão"),
    ("reveal", "Revelação de Senha/Credencial"),
    ("download", "Download de Arquivo"),
    ("login", "Login"),
    ("logout", "Logout"),
    ("failed_login", "Tentativa de Login Falha"),
    ("failed_vault_unlock", "Tentativa de Desbloqueio do Cofre Falha"),
    ("other", "Outro"),
    ("purge", "Purga de Dados (LGPD/GDPR)"),
    ("shared_reveal", "Acesso via Link Compartilhado"),
    ("copy", "Cópia para Área de Transferência"),
)


class ActivityLog(models.Model):
    """
    Modelo para registro de logs de atividades de segurança.
    Registra todas as ações sensíveis realizadas no sistema.

    Não herda de BaseModel pois logs não devem ser editados ou excluídos.
    """

    action = models.CharField(
        max_length=100, choices=ACTION_TYPES, verbose_name="Ação"
    )
    model_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Modelo",
        help_text="Nome do modelo afetado (ex: Password, StoredCreditCard)",
    )
    object_id = models.IntegerField(
        blank=True,
        null=True,
        verbose_name="ID do Objeto",
        help_text="ID do objeto afetado",
    )
    object_uuid = models.UUIDField(
        blank=True,
        null=True,
        verbose_name="UUID do Objeto",
        help_text="UUID público do objeto afetado (correlaciona com a API)",
    )
    description = models.TextField(
        verbose_name="Descrição",
        help_text="Descrição detalhada da ação realizada",
    )
    description_key = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Chave de descrição",
        help_text="Chave i18n para descrição traduzível (ex: password.create)",
    )
    description_params = models.JSONField(
        blank=True,
        null=True,
        verbose_name="Parâmetros da descrição",
        help_text=(
            "Parâmetros dinâmicos para interpolação da chave de descrição"
        ),
    )
    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
        verbose_name="Endereço IP",
        help_text="IP de origem da requisição",
    )
    user_agent = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name="User Agent",
        help_text="Informações do navegador/cliente",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_logs",
        verbose_name="Usuário",
    )
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Data/Hora"
    )

    class Meta:
        verbose_name = "Log de Atividade"
        verbose_name_plural = "Logs de Atividades"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "action"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["model_name", "object_id"]),
            models.Index(fields=["object_uuid"]),
        ]
        # Logs não podem ser editados ou excluídos
        # (usar permissões default do Django)

    def __str__(self):
        user_str = self.user.username if self.user else "Anônimo"
        return (
            f"{user_str} - {self.action}"
            f" - {self.created_at.strftime('%d/%m/%Y %H:%M')}"
        )

    @classmethod
    def log_action(
        cls,
        user,
        action,
        description,
        model_name=None,
        object_id=None,
        object_uuid=None,
        ip_address=None,
        user_agent=None,
        description_key=None,
        description_params=None,
    ):
        return cls.objects.create(
            user=user,
            action=action,
            description=description,
            description_key=description_key,
            description_params=description_params,
            model_name=model_name,
            object_id=object_id,
            object_uuid=object_uuid,
            ip_address=ip_address,
            user_agent=user_agent,
        )


# ============================================================================
# DELETION RECORD MODEL
# ============================================================================


class DeletionRecord(models.Model):
    """
    Immutable compliance certificate confirming that a record UUID was
    hard-deleted by the purge_deleted_records command (LGPD/GDPR).

    Not a BaseModel subclass — deletion certificates must never be edited
    or soft-deleted.
    """

    record_uuid = models.UUIDField(verbose_name="UUID do Registro")
    model_name = models.CharField(max_length=200, verbose_name="Modelo")
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Excluído Em (Soft Delete)",
        help_text="Timestamp do soft-delete original",
    )
    purged_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Removido Em (Hard Delete)",
        help_text="Timestamp em que o registro foi permanentemente removido",
    )

    class Meta:
        verbose_name = "Certificado de Remoção"
        verbose_name_plural = "Certificados de Remoção"
        ordering = ["-purged_at"]
        indexes = [
            models.Index(fields=["record_uuid"]),
            models.Index(fields=["model_name", "purged_at"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.model_name} {self.record_uuid} "
            f"purged at {self.purged_at.strftime('%Y-%m-%dT%H:%M:%SZ')}"
        )


# ============================================================================
# PASSWORD HISTORY MODEL
# ============================================================================


class PasswordHistory(BaseModel):
    """Histório de versões anteriores de uma senha."""

    password = models.ForeignKey(
        "Password",
        on_delete=models.CASCADE,
        related_name="history",
        verbose_name="Senha",
    )
    _old_password = models.TextField(
        verbose_name="Senha Anterior (Criptografada)"
    )
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Alterado por",
    )

    old_password = VaultEncryptedField("_old_password")

    class Meta:
        verbose_name = "Histórico de Senha"
        verbose_name_plural = "Histórico de Senhas"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Histórico de {self.password.title} — {self.created_at}"


# ============================================================================
# VAULT HEALTH SNAPSHOT MODEL
# ============================================================================


class VaultHealthSnapshot(BaseModel):
    """Snapshot diário do score de saúde do cofre para histórico e evolução."""

    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.CASCADE,
        related_name="health_snapshots",
        verbose_name="Proprietário",
    )
    score = models.IntegerField(verbose_name="Score")
    weak_passwords = models.IntegerField(default=0)
    medium_passwords = models.IntegerField(default=0)
    duplicate_passwords = models.IntegerField(default=0)
    outdated_passwords = models.IntegerField(default=0)
    total_passwords = models.IntegerField(default=0)
    snapshot_date = models.DateField(
        auto_now_add=True, verbose_name="Data do Snapshot"
    )

    class Meta:
        verbose_name = "Snapshot de Saúde do Cofre"
        verbose_name_plural = "Snapshots de Saúde do Cofre"
        ordering = ["-snapshot_date"]
        unique_together = ("owner", "snapshot_date")

    def __str__(self):
        return (
            f"Snapshot {self.owner} — {self.snapshot_date} score={self.score}"
        )


# ============================================================================
# VAULT ALERT CONFIG MODEL
# ============================================================================


class VaultAlertConfig(BaseModel):
    """Configuração de alertas de atividade suspeita no cofre por usuário."""

    owner = models.OneToOneField(
        "members.Member",
        on_delete=models.CASCADE,
        related_name="vault_alert_config",
        verbose_name="Proprietário",
    )
    alert_on_new_ip = models.BooleanField(
        default=True, verbose_name="Alertar em novo IP"
    )
    alert_on_failed_unlock = models.BooleanField(
        default=True, verbose_name="Alertar em falha de desbloqueio"
    )
    alert_on_reveal = models.BooleanField(
        default=False, verbose_name="Alertar em revelação de senha"
    )
    failed_unlock_threshold = models.IntegerField(
        default=3, verbose_name="Threshold de falhas de desbloqueio"
    )
    alert_on_excessive_reveals = models.BooleanField(
        default=True,
        verbose_name="Alertar em volume excessivo de revelações",
    )
    excessive_reveals_threshold = models.IntegerField(
        default=5,
        verbose_name="Threshold de revelações em 1 hora",
    )
    alert_on_card_reveal = models.BooleanField(
        default=False,
        verbose_name="Alertar ao revelar cartão bancário",
    )
    notify_email = models.BooleanField(
        default=False,
        verbose_name="Enviar alertas por e-mail",
    )

    class Meta:
        verbose_name = "Configuração de Alertas do Cofre"
        verbose_name_plural = "Configurações de Alertas do Cofre"

    def __str__(self):
        return f"VaultAlertConfig({self.owner})"
