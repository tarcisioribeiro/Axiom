from decimal import Decimal

from django.db import models

from accounts.models import Account
from app.models import PAYMENT_FREQUENCY_CHOICES, BaseModel

REVENUES_CATEGORIES = (
    ("deposit", "Depósito"),
    ("award", "Prêmio"),
    ("salary", "Salário"),
    ("ticket", "Vale"),
    ("income", "Rendimentos"),
    ("refund", "Reembolso"),
    ("cashback", "Cashback"),
    ("transfer", "Transferência Recebida"),
    ("received_loan", "Empréstimo Recebido"),
    ("loan_devolution", "Devolução de empréstimo"),
)


class Revenue(BaseModel):
    description = models.CharField(
        max_length=200, null=False, blank=False, verbose_name="Descrição"
    )
    value = models.DecimalField(
        verbose_name="Valor", null=False, blank=False, max_digits=10, decimal_places=2
    )
    date = models.DateField(verbose_name="Data", null=False, blank=False)
    horary = models.TimeField(verbose_name="Horário", null=False, blank=False)
    category = models.CharField(
        max_length=200,
        choices=REVENUES_CATEGORIES,
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
    received = models.BooleanField(verbose_name="Recebido")
    source = models.CharField(
        max_length=200, verbose_name="Fonte da Receita", null=True, blank=True
    )
    tax_amount = models.DecimalField(
        verbose_name="Valor de Impostos", max_digits=10, decimal_places=2, default=0.00
    )
    net_amount = models.DecimalField(
        verbose_name="Valor Líquido",
        max_digits=10,
        decimal_places=2,
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
    receipt = models.FileField(
        upload_to="revenues/receipts/",
        verbose_name="Comprovante",
        null=True,
        blank=True,
    )
    recurring = models.BooleanField(verbose_name="Receita Recorrente", default=False)
    frequency = models.CharField(
        max_length=20,
        choices=PAYMENT_FREQUENCY_CHOICES,
        verbose_name="Frequência",
        null=True,
        blank=True,
        help_text="Apenas se for recorrente",
    )
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)
    related_transfer = models.ForeignKey(
        "transfers.Transfer",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="generated_revenue",
        verbose_name="Transferência Relacionada",
        help_text="Transferência que gerou esta receita automaticamente",
    )
    related_loan = models.ForeignKey(
        "loans.Loan",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_revenues",
        verbose_name="Empréstimo Relacionado",
        help_text=(
            "Empréstimo que esta receita está recebendo"
            " (quando você emprestou e está recebendo de volta)"
        ),
    )

    class Meta:
        ordering = ["-date"]
        verbose_name = "Receita"
        verbose_name_plural = "Receitas"
        indexes = [
            models.Index(fields=["-date"]),
            models.Index(fields=["category", "date"]),
            models.Index(fields=["account", "date"]),
            models.Index(fields=["received", "date"]),
            models.Index(fields=["account", "category"]),
            models.Index(fields=["related_transfer"]),
            models.Index(fields=["related_loan"]),
        ]

    def save(self, *args, **kwargs):
        """
        Override para calcular automaticamente o valor líquido.

        Calcula o net_amount como value - tax_amount se não foi fornecido.

        Parameters
        ----------
        *args
            Argumentos posicionais do método save.
        **kwargs
            Argumentos nomeados do método save.
        """
        if self.net_amount is None:
            self.net_amount = self.value - Decimal(str(self.tax_amount))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.description}, {self.category} - {self.date}, {self.horary}"
