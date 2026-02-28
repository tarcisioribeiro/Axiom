import hashlib
import hmac as hmac_lib
import os
from datetime import date

from django.contrib.auth.models import User
from django.db import models

from app.encryption import FieldEncryption
from app.models import BaseModel

SEX_OPTION = (("M", "Masculino"), ("F", "Feminino"))


def compute_document_hash(document: str) -> str:
    """Computes HMAC-SHA256 of CPF for uniqueness lookups without exposing the value."""
    key = os.getenv("ENCRYPTION_KEY", "").encode()
    return hmac_lib.new(key, document.encode(), hashlib.sha256).hexdigest()


class _DocumentField:
    """
    Descriptor that transparently encrypts CPF into _document
    and keeps document_hash in sync for DB-level uniqueness lookups.
    """

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        raw = getattr(obj, "_document", None)
        if raw:
            try:
                return FieldEncryption.decrypt_data(raw)
            except Exception:
                return None
        return None

    def __set__(self, obj, value):
        if value:
            v = str(value)
            obj._document = FieldEncryption.encrypt_data(v)
            obj.document_hash = compute_document_hash(v)
        else:
            obj._document = None
            obj.document_hash = None


class Member(BaseModel):
    name = models.CharField(
        max_length=200, null=False, blank=False, verbose_name="Nome"
    )
    _document = models.TextField(
        null=True, blank=True, verbose_name="Documento (Criptografado)"
    )
    document_hash = models.CharField(
        max_length=64,
        unique=True,
        verbose_name="Hash do Documento",
    )
    phone = models.CharField(
        max_length=200, blank=False, null=False, verbose_name="Telefone"
    )
    email = models.CharField(
        max_length=200, blank=True, null=True, verbose_name="Email"
    )
    sex = models.CharField(max_length=200, choices=SEX_OPTION, verbose_name="Sexo")
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name="Usuário do Sistema",
        help_text="Vincular membro a um usuário do sistema para permitir login",
    )
    is_creditor = models.BooleanField(
        verbose_name="Credor", null=False, blank=False, default=True
    )
    is_benefited = models.BooleanField(
        verbose_name="Beneficiário", null=False, blank=False, default=True
    )
    active = models.BooleanField(
        verbose_name="Ativo", null=False, blank=False, default=True
    )
    birth_date = models.DateField(
        verbose_name="Data de Nascimento", null=True, blank=True
    )
    address = models.TextField(verbose_name="Endereço", null=True, blank=True)
    profile_photo = models.ImageField(
        upload_to="members/photos/",
        verbose_name="Foto de Perfil",
        null=True,
        blank=True,
    )
    emergency_contact = models.CharField(
        max_length=200, verbose_name="Contato de Emergência", null=True, blank=True
    )
    monthly_income = models.DecimalField(
        verbose_name="Renda Mensal",
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    occupation = models.CharField(
        max_length=200, verbose_name="Profissão", null=True, blank=True
    )
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)

    # Python-level descriptor: transparently encrypts/decrypts CPF
    document = _DocumentField()

    class Meta:
        verbose_name = "Membro"
        verbose_name_plural = "Membros"

    def save(self, *args, **kwargs):
        if self._document:
            plain = FieldEncryption.decrypt_data(self._document)
            if plain:
                self.document_hash = compute_document_hash(plain)
        super().save(*args, **kwargs)

    @property
    def is_user(self):
        return self.user is not None

    @property
    def age(self):
        if self.birth_date:
            today = date.today()
            return (
                today.year
                - self.birth_date.year
                - (
                    (today.month, today.day)
                    < (self.birth_date.month, self.birth_date.day)
                )
            )
        return None

    def __str__(self):
        return self.name
