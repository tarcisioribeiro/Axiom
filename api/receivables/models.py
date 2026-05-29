from django.db import models

from app.models import BaseModel
from revenues.models import REVENUES_CATEGORIES

RECEIVABLE_STATUS_CHOICES = (
    ("active", "Ativo"),
    ("received", "Recebido"),
    ("overdue", "Em atraso"),
    ("cancelled", "Cancelado"),
)


class Receivable(BaseModel):
    """
    Modelo para rastrear valores a receber (créditos) que não são empréstimos.

    Exemplos: honorários a receber, serviços prestados, reembolsos pendentes.

    Espelho do modelo Payable para o lado de receitas: ao registrar um
    Receivable
    NÃO é criada uma despesa correspondente, pois ainda não houve saída
    de dinheiro.
    """

    description = models.CharField(
        max_length=200, verbose_name="Descrição", null=False, blank=False
    )
    value = models.DecimalField(
        verbose_name="Valor Total",
        null=False,
        blank=False,
        max_digits=10,
        decimal_places=2,
    )
    received_value = models.DecimalField(
        verbose_name="Valor Recebido",
        null=False,
        blank=False,
        max_digits=10,
        decimal_places=2,
        default=0,
    )
    date = models.DateField(
        verbose_name="Data de Registro", null=False, blank=False
    )
    due_date = models.DateField(
        verbose_name="Data de Vencimento", null=True, blank=True
    )
    category = models.CharField(
        max_length=200,
        choices=REVENUES_CATEGORIES,
        null=False,
        blank=False,
        verbose_name="Categoria",
    )
    member = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        verbose_name="Devedor (Membro)",
        null=True,
        blank=True,
    )
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=RECEIVABLE_STATUS_CHOICES,
        verbose_name="Status",
        default="active",
    )

    class Meta:
        ordering = ["-date"]
        verbose_name = "Valor a Receber"
        verbose_name_plural = "Valores a Receber"
        indexes = [
            models.Index(fields=["-date"]),
            models.Index(fields=["status", "-date"]),
            models.Index(fields=["category", "-date"]),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.received_value and self.value:
            if self.received_value > self.value:
                raise ValidationError(
                    {
                        "received_value": (
                            "O valor recebido não pode ser"
                            " maior que o valor total."
                        )
                    }
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        if self.received_value >= self.value and self.status == "active":
            self.status = "received"
        super().save(*args, **kwargs)

    @property
    def remaining_value(self):
        return self.value - self.received_value

    def __str__(self):
        return (
            f"{self.description} - R$ {self.value}"
            f" ({self.get_status_display()})"
        )


class ReceivableInstallment(BaseModel):
    """Parcela individual de um valor a receber."""

    receivable = models.ForeignKey(
        Receivable,
        on_delete=models.CASCADE,
        related_name="installments",
        verbose_name="Valor a Receber",
    )
    installment_number = models.PositiveIntegerField(
        verbose_name="Número da Parcela"
    )
    value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=False,
        blank=False,
        verbose_name="Valor",
    )
    due_date = models.DateField(verbose_name="Data de Vencimento")
    received = models.BooleanField(default=False, verbose_name="Recebido")
    receipt_revenue = models.ForeignKey(
        "revenues.Revenue",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receivable_installment_receipts",
        verbose_name="Receita de Recebimento",
    )

    class Meta:
        ordering = ["receivable", "installment_number"]
        verbose_name = "Parcela de Valor a Receber"
        verbose_name_plural = "Parcelas de Valores a Receber"
        constraints = [
            models.UniqueConstraint(
                fields=["receivable", "installment_number"],
                name="unique_receivable_installment_number",
            )
        ]
        indexes = [
            models.Index(fields=["receivable", "received"]),
            models.Index(fields=["due_date"]),
        ]

    def __str__(self):
        return (
            f"Parcela {self.installment_number}"
            f" - {self.receivable.description}"
        )
