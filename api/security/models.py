from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from app.models import BaseModel
from app.encryption import DecryptionError, EncryptedField, FieldEncryption, MaskedEncryptedField


# ============================================================================
# PASSWORD MODEL
# ============================================================================

PASSWORD_CATEGORIES = (
    ('social', 'Redes Sociais'),
    ('email', 'E-mail'),
    ('banking', 'Bancário'),
    ('work', 'Trabalho'),
    ('entertainment', 'Entretenimento'),
    ('shopping', 'Compras'),
    ('streaming', 'Streaming'),
    ('gaming', 'Games'),
    ('other', 'Outro')
)


class Password(BaseModel):
    """
    Modelo para armazenamento seguro de senhas.
    Todas as senhas são criptografadas usando Fernet.
    """
    title = models.CharField(max_length=200, verbose_name="Título")
    site = models.URLField(max_length=500, verbose_name="Site", blank=True, null=True)
    username = models.CharField(max_length=200, verbose_name="Usuário/Email")
    _password = models.TextField(verbose_name="Senha (Criptografada)")
    category = models.CharField(max_length=100, choices=PASSWORD_CATEGORIES, default='other')
    notes = models.TextField(blank=True, null=True, verbose_name="Observações")
    last_password_change = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey('members.Member', on_delete=models.PROTECT, related_name='passwords')

    password = EncryptedField('_password')

    class Meta:
        verbose_name = "Senha"
        verbose_name_plural = "Senhas"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.username}"


# ============================================================================
# STORED CREDIT CARD MODEL
# ============================================================================

FLAGS = (
    ('MSC', 'Mastercard'),
    ('VSA', 'Visa'),
    ('ELO', 'Elo'),
    ('EXP', 'American Express'),
    ('HCD', 'Hipercard'),
    ('DIN', 'Diners Club'),
    ('OTHER', 'Outro')
)


def _normalize_card_number(value: object) -> str:
    return str(value).replace(' ', '').replace('-', '')


def _validate_card_number(value: str) -> None:
    if not value.isdigit() or len(value) < 13 or len(value) > 19:
        raise ValidationError("Número do cartão inválido.")


def _validate_cvv(value: str) -> None:
    if not value.isdigit() or len(value) not in [3, 4]:
        raise ValidationError("CVV inválido.")


class StoredCreditCard(BaseModel):
    """Armazenamento seguro de credenciais de cartões de crédito."""
    name = models.CharField(max_length=200, verbose_name="Nome do Cartão")
    _card_number = models.TextField(verbose_name="Número do Cartão (Criptografado)")
    _security_code = models.TextField(verbose_name="CVV (Criptografado)")
    expiration_month = models.IntegerField(verbose_name="Mês de Validade")
    expiration_year = models.IntegerField(verbose_name="Ano de Validade")
    cardholder_name = models.CharField(max_length=200, verbose_name="Nome do Titular")
    flag = models.CharField(max_length=50, choices=FLAGS, verbose_name="Bandeira")
    notes = models.TextField(blank=True, null=True, verbose_name="Observações")
    owner = models.ForeignKey('members.Member', on_delete=models.PROTECT, related_name='stored_credit_cards')
    finance_card = models.ForeignKey('credit_cards.CreditCard', on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='stored_credentials')

    card_number = EncryptedField(
        '_card_number',
        preprocessor=_normalize_card_number,
        validator=_validate_card_number,
    )
    card_number_masked = MaskedEncryptedField('_card_number')
    security_code = EncryptedField(
        '_security_code',
        preprocessor=lambda v: str(v).strip(),
        validator=_validate_cvv,
    )

    class Meta:
        verbose_name = "Cartão Armazenado"
        verbose_name_plural = "Cartões Armazenados"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.flag} ({self.card_number_masked})"


# ============================================================================
# STORED BANK ACCOUNT MODEL
# ============================================================================

ACCOUNT_TYPES = (
    ('CC', 'Conta Corrente'),
    ('CS', 'Conta Salário'),
    ('CP', 'Conta Poupança'),
    ('CI', 'Conta Investimento'),
    ('OTHER', 'Outro')
)


class StoredBankAccount(BaseModel):
    """Armazenamento seguro de credenciais de contas bancárias."""
    name = models.CharField(max_length=200, verbose_name="Nome da Conta")
    institution_name = models.CharField(max_length=200, verbose_name="Instituição Financeira")
    account_type = models.CharField(max_length=50, choices=ACCOUNT_TYPES)
    _account_number = models.TextField(verbose_name="Número da Conta (Criptografado)")
    agency = models.CharField(max_length=10, blank=True, null=True)
    _password = models.TextField(verbose_name="Senha Bancária (Criptografada)", blank=True, null=True)
    _digital_password = models.TextField(verbose_name="Senha Digital (Criptografada)", blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    owner = models.ForeignKey('members.Member', on_delete=models.PROTECT, related_name='stored_bank_accounts')
    finance_account = models.ForeignKey('accounts.Account', on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name='stored_credentials')

    account_number = EncryptedField('_account_number')
    account_number_masked = MaskedEncryptedField('_account_number')
    password = EncryptedField('_password')
    digital_password = EncryptedField('_digital_password')

    class Meta:
        verbose_name = "Conta Bancária Armazenada"
        verbose_name_plural = "Contas Bancárias Armazenadas"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.institution_name}"


# ============================================================================
# ARCHIVE MODEL
# ============================================================================

ARCHIVE_TYPES = (
    ('text', 'Texto'),
    ('pdf', 'PDF'),
    ('image', 'Imagem'),
    ('document', 'Documento'),
    ('other', 'Outro')
)

ARCHIVE_CATEGORIES = (
    ('personal', 'Pessoal'),
    ('financial', 'Financeiro'),
    ('legal', 'Jurídico'),
    ('medical', 'Médico'),
    ('tax', 'Impostos'),
    ('work', 'Trabalho'),
    ('other', 'Outro')
)


class Archive(BaseModel):
    """Armazenamento seguro de arquivos confidenciais."""
    title = models.CharField(max_length=200, verbose_name="Título")
    category = models.CharField(max_length=100, choices=ARCHIVE_CATEGORIES, default='other')
    archive_type = models.CharField(max_length=50, choices=ARCHIVE_TYPES, default='other')
    _encrypted_text = models.TextField(blank=True, null=True, verbose_name="Texto Criptografado")
    encrypted_file = models.FileField(upload_to='security/archives/%Y/%m/', blank=True, null=True)
    file_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Nome do Arquivo")
    file_size = models.BigIntegerField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    tags = models.CharField(max_length=500, blank=True, null=True)
    owner = models.ForeignKey('members.Member', on_delete=models.PROTECT, related_name='archives')

    @property
    def text_content(self):
        if self._encrypted_text:
            try:
                return FieldEncryption.decrypt_data(self._encrypted_text)
            except DecryptionError:
                return None
        return None

    @text_content.setter
    def text_content(self, value):
        if value:
            self._encrypted_text = FieldEncryption.encrypt_data(str(value))
            self.file_size = len(str(value).encode('utf-8'))
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
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.category}"
