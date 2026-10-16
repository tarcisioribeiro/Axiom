import hashlib
import hmac as hmac_lib
import os
import re
from decimal import Decimal
from typing import Any

from django.db import models

from app.encryption import (
    EncryptedField,
    FieldEncryption,
    MaskedEncryptedField,
)
from app.models import BaseModel

ACCOUNT_TYPES = (
    ("CC", "Conta Corrente"),
    ("CS", "Conta Salário"),
    ("FG", "Fundo de Garantia"),
    ("VA", "Vale Alimentação"),
    ("CM", "Carteira Móvel"),
)

WALLET_ACCOUNT_TYPE = "CM"

ACCOUNT_NAMES = (
    ("NUB", "Nubank"),
    ("SIC", "Sicoob"),
    ("MPG", "Mercado Pago"),
    ("IFB", "Ifood Benefícios"),
    ("CEF", "Caixa Econômica Federal"),
)


def compute_account_number_hash(account_number: str, key: str) -> str:
    """
    HMAC-SHA256 do número da conta normalizado (sem espaços, pontos, traços
    e em maiúsculas), para checar duplicidade sem expor o valor.
    """
    normalized = re.sub(r"[\s.\-]", "", account_number).upper()
    return hmac_lib.new(
        key.encode(), normalized.encode(), hashlib.sha256
    ).hexdigest()


class Account(BaseModel):
    account_name = models.CharField(
        max_length=200,
        null=False,
        blank=False,
        default="Conta",
        verbose_name="Nome da conta",
    )
    institution_name = models.CharField(
        max_length=200,
        choices=ACCOUNT_NAMES,
        null=False,
        blank=False,
        default="CEF",
        verbose_name="Institution",
    )
    account_type = models.CharField(
        max_length=100, choices=ACCOUNT_TYPES, verbose_name="Tipo de Conta"
    )
    account_image = models.ImageField(
        upload_to="accounts/",
        blank=True,
        null=True,
        verbose_name="Logo da conta",
    )
    is_active = models.BooleanField(verbose_name="Ativa", default=True)
    _account_number = models.TextField(
        verbose_name="Número da Conta (Criptografado)",
        null=True,
        blank=True,
        help_text="Campo criptografado",
    )
    agency = models.CharField(
        max_length=20, verbose_name="Agência", null=True, blank=True
    )
    bank_code = models.CharField(
        max_length=10, verbose_name="Código do Banco", null=True, blank=True
    )
    current_balance = models.DecimalField(
        verbose_name="Saldo Atual",
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    minimum_balance = models.DecimalField(
        verbose_name="Saldo Mínimo",
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    overdraft_limit = models.DecimalField(
        verbose_name="Limite de Cheque Especial",
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Limite máximo de débito negativo permitido na conta",
    )
    opening_date = models.DateField(
        verbose_name="Data de Abertura", null=True, blank=True
    )
    description = models.TextField(
        verbose_name="Descrição/Observações", null=True, blank=True
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        verbose_name="Proprietário",
        null=True,
        blank=True,
    )

    account_number_hash = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        verbose_name="Hash do Número da Conta",
    )

    account_number = EncryptedField("_account_number")
    account_number_masked = MaskedEncryptedField("_account_number")

    class Meta:
        ordering = ["-account_name"]
        verbose_name = "Conta"
        verbose_name_plural = "Contas"
        constraints = [
            models.UniqueConstraint(
                fields=["created_by"],
                condition=models.Q(account_type="CM", is_deleted=False),
                name="unique_wallet_account_per_user",
            ),
            models.UniqueConstraint(
                fields=[
                    "created_by",
                    "institution_name",
                    "account_number_hash",
                ],
                condition=models.Q(
                    is_deleted=False, account_number_hash__isnull=False
                ),
                name="unique_account_number_per_institution_per_user",
            ),
        ]

    def __str__(self) -> str:
        return self.account_name

    def save(self, *args: Any, **kwargs: Any) -> None:
        update_fields = kwargs.get("update_fields")
        if not update_fields or "_account_number" in update_fields:
            plain = (
                FieldEncryption.decrypt_data(self._account_number)
                if self._account_number
                else None
            )
            self.account_number_hash = (
                compute_account_number_hash(
                    plain, os.getenv("ENCRYPTION_KEY", "")
                )
                if plain
                else None
            )
            if update_fields:
                kwargs["update_fields"] = {
                    *update_fields,
                    "account_number_hash",
                }
        super().save(*args, **kwargs)

    @property
    def deposited_in_vaults(self) -> Decimal:
        """
        Total reservado em cofres ativos desta conta (principal + rendimento).

        O rendimento é lançado como receita na conta quando aplicado
        (categoria ``income``), portanto o saldo cheio do cofre fica reservado
        e não infla o saldo disponível da conta.
        """
        total = Decimal("0.00")
        for vault in self.vaults.all():
            if vault.is_active and not vault.is_deleted:
                if vault.current_balance > 0:
                    total += vault.current_balance
        return total

    @property
    def available_balance(self) -> Decimal:
        """Saldo disponível para débito (total menos reservado em cofres)."""
        return self.current_balance - self.deposited_in_vaults
