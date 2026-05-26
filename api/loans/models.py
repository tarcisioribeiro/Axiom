from django.db import models

from accounts.models import Account
from app.models import (
    LOAN_STATUS_CHOICES,
    PAYMENT_FREQUENCY_CHOICES,
    BaseModel,
)
from expenses.models import EXPENSES_CATEGORIES
from members.models import Member


class Loan(BaseModel):
    description = models.CharField(
        max_length=200, verbose_name="Descrição", null=False, blank=False
    )
    value = models.DecimalField(
        verbose_name="Valor",
        null=False,
        blank=False,
        max_digits=10,
        decimal_places=2,
    )
    payed_value = models.DecimalField(
        verbose_name="Valor Pago",
        null=False,
        blank=False,
        max_digits=10,
        decimal_places=2,
    )
    date = models.DateField(verbose_name="Data", null=False, blank=False)
    horary = models.TimeField(verbose_name="Horário", null=False, blank=False)
    category = models.CharField(
        max_length=200,
        choices=EXPENSES_CATEGORIES,
        null=False,
        blank=False,
        verbose_name="Categoria",
    )
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Conta",
    )
    benefited = models.ForeignKey(
        Member,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Beneficiado",
        related_name="Benefited",
    )
    creditor = models.ForeignKey(
        Member,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Credor",
        related_name="Creditor",
    )
    payed = models.BooleanField(verbose_name="Pago", default=False)
    interest_rate = models.DecimalField(
        verbose_name="Taxa de Juros (%)",
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )
    installments = models.IntegerField(
        verbose_name="Número de Parcelas", default=1
    )
    due_date = models.DateField(
        verbose_name="Data de Vencimento", null=True, blank=True
    )
    contract_document = models.FileField(
        upload_to="loans/contracts/",
        verbose_name="Documento do Contrato",
        null=True,
        blank=True,
    )
    payment_frequency = models.CharField(
        max_length=20,
        choices=PAYMENT_FREQUENCY_CHOICES,
        verbose_name="Frequência de Pagamento",
        default="monthly",
    )
    late_fee = models.DecimalField(
        verbose_name="Multa por Atraso",
        max_digits=10,
        decimal_places=2,
        default=0.00,
    )
    guarantor = models.ForeignKey(
        Member,
        on_delete=models.PROTECT,
        verbose_name="Avalista",
        related_name="Guarantor",
        null=True,
        blank=True,
    )
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)
    currency_code = models.CharField(
        max_length=3,
        default="BRL",
        verbose_name="Moeda",
        help_text="Código ISO 4217 da moeda (ex: BRL, USD, EUR)",
    )
    status = models.CharField(
        max_length=20,
        choices=LOAN_STATUS_CHOICES,
        verbose_name="Status",
        default="active",
    )

    class Meta:
        ordering = ["-date"]
        verbose_name = "Empréstimo"
        verbose_name_plural = "Empréstimos"

    def clean(self):
        """
        Valida os dados do empréstimo antes de salvar.

        Raises
        ------
        ValidationError
            Se payed_value for maior que value
        """
        from django.core.exceptions import ValidationError

        # Validar que valor pago não excede valor total
        if self.payed_value and self.value:
            if self.payed_value > self.value:
                raise ValidationError(
                    {
                        "payed_value": (
                            "O valor pago não pode ser maior que"
                            " o valor total do empréstimo."
                        )
                    }
                )

    def save(self, *args, **kwargs):
        """Auto-deriva payed a partir de payed_value e chama full_clean."""
        if self.payed_value is not None and self.value is not None:
            self.payed = self.payed_value >= self.value
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"""{
            self.description
        },{self.category} - {self.date},{self.horary}"""


class LoanInstallment(BaseModel):
    """
    Parcela individual de um empréstimo.

    Gerada automaticamente quando um Loan com installments > 1 é criado.
    Cada parcela pode ser marcada individualmente como paga, vinculando
    à Expense de pagamento correspondente.
    """

    loan = models.ForeignKey(
        Loan,
        on_delete=models.CASCADE,
        related_name="installment_schedule",
        verbose_name="Empréstimo",
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
        related_name="loan_installment_payments",
        verbose_name="Despesa de Pagamento",
    )

    class Meta:
        ordering = ["loan", "installment_number"]
        verbose_name = "Parcela de Empréstimo"
        verbose_name_plural = "Parcelas de Empréstimo"
        constraints = [
            models.UniqueConstraint(
                fields=["loan", "installment_number"],
                name="unique_loan_installment_number",
            )
        ]
        indexes = [
            models.Index(fields=["loan", "payed"]),
            models.Index(fields=["due_date"]),
        ]

    def __str__(self):
        return f"Parcela {self.installment_number}/{self.loan.installments} - {self.loan.description}"  # noqa: E501
