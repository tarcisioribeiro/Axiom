from django.db import models

from app.models import BaseModel
from expenses.models import EXPENSES_CATEGORIES

PAYABLE_STATUS_CHOICES = (
    ("active", "Ativo"),
    ("paid", "Quitado"),
    ("overdue", "Em atraso"),
    ("cancelled", "Cancelado"),
)


class Payable(BaseModel):
    """
    Modelo para rastrear valores a pagar (dívidas) que não são empréstimos.

    Exemplos: conta de dentista, conserto de carro, tratamento médico.

    Diferente de empréstimos, ao registrar um Payable NÃO é criada uma
    receita correspondente (já que não há entrada de dinheiro).
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
    paid_value = models.DecimalField(
        verbose_name="Valor Pago",
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
        choices=EXPENSES_CATEGORIES,
        null=False,
        blank=False,
        verbose_name="Categoria",
    )
    member = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        verbose_name="Membro Responsável",
        null=True,
        blank=True,
    )
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=PAYABLE_STATUS_CHOICES,
        verbose_name="Status",
        default="active",
    )

    class Meta:
        ordering = ["-date"]
        verbose_name = "Valor a Pagar"
        verbose_name_plural = "Valores a Pagar"
        indexes = [
            models.Index(fields=["-date"]),
            models.Index(fields=["status", "-date"]),
            models.Index(fields=["category", "-date"]),
        ]

    def clean(self):
        """
        Valida os dados antes de salvar.

        Raises
        ------
        ValidationError
            Se paid_value for maior que value
        """
        from django.core.exceptions import ValidationError

        if self.paid_value and self.value:
            if self.paid_value > self.value:
                raise ValidationError(
                    {
                        "paid_value": (
                            "O valor pago não pode ser"
                            " maior que o valor total."
                        )
                    }
                )

    def save(self, *args, **kwargs):
        """
        Sobrescreve save para chamar full_clean e atualizar status.
        """
        self.full_clean()

        # Atualizar status automaticamente se completamente pago
        if self.paid_value >= self.value and self.status == "active":
            self.status = "paid"

        super().save(*args, **kwargs)

    @property
    def remaining_value(self):
        """Calcula o valor restante a pagar."""
        return self.value - self.paid_value

    def __str__(self):
        return (
            f"{self.description} - R$ {self.value}"
            f" ({self.get_status_display()})"
        )


class PayableInstallment(BaseModel):
    """
    Parcela individual de um valor a pagar.

    Permite parcelamento de dívidas (ex: dentista em 6x).
    Cada parcela pode ser marcada individualmente como paga.
    """

    payable = models.ForeignKey(
        Payable,
        on_delete=models.CASCADE,
        related_name="installments",
        verbose_name="Valor a Pagar",
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
    payed = models.BooleanField(default=False, verbose_name="Pago")
    payment_expense = models.ForeignKey(
        "expenses.Expense",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payable_installment_payments",
        verbose_name="Despesa de Pagamento",
    )

    class Meta:
        ordering = ["payable", "installment_number"]
        verbose_name = "Parcela de Valor a Pagar"
        verbose_name_plural = "Parcelas de Valores a Pagar"
        constraints = [
            models.UniqueConstraint(
                fields=["payable", "installment_number"],
                name="unique_payable_installment_number",
            )
        ]
        indexes = [
            models.Index(fields=["payable", "payed"]),
            models.Index(fields=["due_date"]),
        ]

    def __str__(self):
        return (
            f"Parcela {self.installment_number} - {self.payable.description}"
        )
