from django.contrib.auth.models import User
from django.db import models

from accounts.models import Account
from app.models import BaseModel
from expenses.models import Expense
from revenues.models import Revenue

FILE_FORMAT_CHOICES = (
    ("ofx", "OFX"),
    ("csv", "CSV"),
    ("cnab240", "CNAB 240"),
    ("cnab400", "CNAB 400"),
)

IMPORT_STATUS_CHOICES = (
    ("processing", "Processando"),
    ("completed", "Concluído"),
    ("failed", "Falhou"),
)

ENTRY_STATUS_CHOICES = (
    ("pending", "Pendente"),
    ("matched", "Conciliado"),
    ("unmatched", "Divergente"),
    ("ignored", "Ignorado"),
)

TRANSACTION_TYPE_CHOICES = (
    ("debit", "Débito"),
    ("credit", "Crédito"),
)

CONFIDENCE_CHOICES = (
    ("high", "Alta"),
    ("medium", "Média"),
    ("low", "Baixa"),
    ("manual", "Manual"),
)


class BankStatementImport(BaseModel):
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="bank_statement_imports",
        verbose_name="Proprietário",
    )
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="bank_statement_imports",
        verbose_name="Conta",
    )
    file_hash = models.CharField(
        max_length=64,
        verbose_name="Hash do Arquivo",
    )
    original_filename = models.CharField(
        max_length=255,
        verbose_name="Nome Original do Arquivo",
    )
    file_format = models.CharField(
        max_length=20,
        choices=FILE_FORMAT_CHOICES,
        verbose_name="Formato",
    )
    status = models.CharField(
        max_length=12,
        choices=IMPORT_STATUS_CHOICES,
        default="processing",
        verbose_name="Status",
    )
    total_entries = models.PositiveIntegerField(
        default=0,
        verbose_name="Total de Entradas",
    )
    matched_count = models.PositiveIntegerField(
        default=0,
        verbose_name="Conciliados",
    )
    unmatched_count = models.PositiveIntegerField(
        default=0,
        verbose_name="Divergentes",
    )
    ignored_count = models.PositiveIntegerField(
        default=0,
        verbose_name="Ignorados",
    )
    error_message = models.TextField(
        null=True,
        blank=True,
        verbose_name="Mensagem de Erro",
    )

    class Meta:
        verbose_name = "Importação de Extrato"
        verbose_name_plural = "Importações de Extrato"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["owner", "file_hash"],
                name="brec_import_owner_hash_idx",
            ),
        ]

    def __str__(self):
        return f"{self.original_filename} ({self.status})"


class BankStatementEntry(BaseModel):
    statement_import = models.ForeignKey(
        BankStatementImport,
        on_delete=models.CASCADE,
        related_name="entries",
        verbose_name="Importação",
    )
    transaction_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="ID da Transação",
    )
    date = models.DateField(verbose_name="Data")
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="Valor",
    )
    description = models.CharField(
        max_length=500,
        verbose_name="Descrição",
    )
    transaction_type = models.CharField(
        max_length=6,
        choices=TRANSACTION_TYPE_CHOICES,
        verbose_name="Tipo",
    )
    status = models.CharField(
        max_length=10,
        choices=ENTRY_STATUS_CHOICES,
        default="pending",
        verbose_name="Status",
    )
    matched_expense = models.ForeignKey(
        Expense,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bank_reconciliation_entries",
        verbose_name="Despesa Conciliada",
    )
    matched_revenue = models.ForeignKey(
        Revenue,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bank_reconciliation_entries",
        verbose_name="Receita Conciliada",
    )
    match_confidence = models.CharField(
        max_length=6,
        choices=CONFIDENCE_CHOICES,
        null=True,
        blank=True,
        verbose_name="Confiança do Match",
    )

    class Meta:
        verbose_name = "Entrada do Extrato"
        verbose_name_plural = "Entradas do Extrato"
        ordering = ["date"]
        indexes = [
            models.Index(
                fields=["statement_import", "status"],
                name="brec_entry_import_status_idx",
            ),
            models.Index(
                fields=["statement_import", "date"],
                name="brec_entry_import_date_idx",
            ),
        ]

    def __str__(self):
        return f"{self.date} {self.description} ({self.amount})"
