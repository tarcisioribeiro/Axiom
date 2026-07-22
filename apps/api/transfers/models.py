from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from accounts.models import Account
from app.models import BaseModel

TRANSFER_CATEGORIES = (
    ("doc", "DOC"),
    ("ted", "TED"),
    ("pix", "PIX"),
)


class Transfer(BaseModel):
    description = models.CharField(
        max_length=200, null=False, blank=False, verbose_name="Descrição"
    )
    value = models.DecimalField(
        verbose_name="Valor",
        null=False,
        blank=False,
        decimal_places=2,
        max_digits=10,
    )
    date = models.DateField(verbose_name="Data", null=False, blank=False)
    horary = models.TimeField(verbose_name="Horário", null=False, blank=False)
    category = models.CharField(
        max_length=200,
        choices=TRANSFER_CATEGORIES,
        null=False,
        blank=False,
        verbose_name="Categoria",
    )
    origin_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Conta de Origem",
        related_name="Credora",
    )
    destiny_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Conta de Destino",
        related_name="Beneficiada",
    )
    transfered = models.BooleanField(verbose_name="Transferido", default=False)
    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pendente"),
            ("processing", "Processando"),
            ("completed", "Concluída"),
            ("failed", "Falhou"),
            ("cancelled", "Cancelada"),
        ],
        default="pending",
        verbose_name="Status",
    )
    currency_code = models.CharField(
        max_length=3,
        default="BRL",
        verbose_name="Moeda",
        help_text="Código ISO 4217 da moeda (ex: BRL, USD, EUR)",
    )
    transaction_id = models.CharField(
        max_length=100,
        verbose_name="ID da Transação",
        null=True,
        blank=True,
        unique=True,
    )
    fee = models.DecimalField(
        verbose_name="Taxa", max_digits=10, decimal_places=2, default=0.00
    )
    exchange_rate = models.DecimalField(
        verbose_name="Taxa de Câmbio",
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
    )
    processed_at = models.DateTimeField(
        verbose_name="Processado em", null=True, blank=True
    )
    confirmation_code = models.CharField(
        max_length=50,
        verbose_name="Código de Confirmação",
        null=True,
        blank=True,
    )
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)
    receipt = models.FileField(
        upload_to="transfers/receipts/",
        verbose_name="Comprovante",
        null=True,
        blank=True,
    )
    member = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        verbose_name="Membro Responsável",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "Transferência"
        verbose_name_plural = "Transferências"

    def clean(self):
        """
        Valida os dados da transferência antes de salvar.

        Raises
        ------
        ValidationError
            Se origin_account for igual a destiny_account
        """
        from django.core.exceptions import ValidationError

        # Validar que conta de origem é diferente da conta de destino
        if self.origin_account and self.destiny_account:
            if self.origin_account == self.destiny_account:
                raise ValidationError(
                    {
                        "destiny_account": (
                            "A conta de destino deve ser diferente"
                            " da conta de origem."
                        )
                    }
                )

    def save(self, *args, **kwargs):
        """Sincroniza transfered ↔ status para compatibilidade retroativa."""
        if self.transfered and self.status == "pending":
            self.status = "completed"
        elif self.status == "completed":
            self.transfered = True
        elif self.status in ("failed", "cancelled") and self.transfered:
            self.transfered = False
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"""{
            self.description
            },{
                self.category
            } - {
                self.date
            },{
                self.horary
            }: [{
                self.origin_account
            } -> {
                self.destiny_account
            }]
        """


class FixedTransfer(BaseModel):
    """
    Template para transferências fixas mensais recorrentes.
    Exemplo: "Dia 5, R$800 para conta conjunta".

    A geração é manual via endpoint /fixed-transfers/generate/
    (análogo a FixedExpense).
    """

    description = models.CharField(
        max_length=200, null=False, blank=False, verbose_name="Descrição"
    )
    value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=False,
        blank=False,
        verbose_name="Valor",
    )
    category = models.CharField(
        max_length=20,
        choices=TRANSFER_CATEGORIES,
        null=False,
        blank=False,
        verbose_name="Tipo",
    )
    origin_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Conta de Origem",
        related_name="fixed_transfer_origins",
    )
    destiny_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Conta de Destino",
        related_name="fixed_transfer_destinations",
    )
    due_day = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        null=False,
        blank=False,
        verbose_name="Dia de Execução",
        help_text="Dia do mês em que a transferência deve ocorrer (1-31)",
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Ativa",
    )
    fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Taxa",
    )
    last_generated_month = models.CharField(
        max_length=7,
        null=True,
        blank=True,
        verbose_name="Último Mês Gerado",
        help_text="Formato: YYYY-MM",
    )
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)

    class Meta:
        ordering = ["due_day", "description"]
        verbose_name = "Transferência Fixa"
        verbose_name_plural = "Transferências Fixas"
        indexes = [
            models.Index(fields=["is_active", "due_day"]),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.origin_account and self.destiny_account:
            if self.origin_account == self.destiny_account:
                raise ValidationError(
                    {
                        "destiny_account": (
                            "A conta de destino deve ser diferente"
                            " da de origem."
                        )
                    }
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.description} - Dia {self.due_day}"


class FixedTransferGenerationLog(BaseModel):
    """
    Histórico de geração de transferências fixas por mês. Previne duplicação.
    """

    month = models.CharField(
        max_length=7,
        unique=True,
        null=False,
        blank=False,
        verbose_name="Mês",
        help_text="Formato: YYYY-MM",
    )
    generated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Gerado Por",
    )
    total_generated = models.PositiveIntegerField(
        default=0, verbose_name="Total Gerado"
    )
    fixed_transfer_ids = models.JSONField(
        default=list,
        verbose_name="IDs das Transferências Fixas",
    )

    class Meta:
        ordering = ["-month"]
        verbose_name = "Log de Geração de Transferências Fixas"
        verbose_name_plural = "Logs de Geração de Transferências Fixas"

    def __str__(self):
        return (
            f"Geração Transferências {self.month}"
            f" - {self.total_generated} transferências"
        )
