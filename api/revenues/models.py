from decimal import Decimal

from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
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
        verbose_name="Valor",
        null=False,
        blank=False,
        max_digits=10,
        decimal_places=2,
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
        verbose_name="Valor de Impostos",
        max_digits=10,
        decimal_places=2,
        default=0.00,
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
    recurring = models.BooleanField(
        verbose_name="Receita Recorrente", default=False
    )
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
    related_receivable = models.ForeignKey(
        "receivables.Receivable",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipt_revenues",
        verbose_name="Valor a Receber Relacionado",
    )
    currency_code = models.CharField(
        max_length=3,
        default="BRL",
        verbose_name="Moeda",
        help_text="Código ISO 4217 da moeda (ex: BRL, USD, EUR)",
    )
    is_initial_balance = models.BooleanField(
        default=False,
        verbose_name="Saldo Inicial",
        help_text=(
            "Receita gerada automaticamente a partir do saldo inicial da conta"
        ),
    )
    tags = models.ManyToManyField(
        "expenses.Tag",
        blank=True,
        related_name="revenues",
        verbose_name="Tags",
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
            models.Index(fields=["related_receivable"]),
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
        return (
            f"{self.description}, {self.category} - {self.date}, {self.horary}"
        )


class FixedRevenue(BaseModel):
    """
    Template para receitas fixas mensais recorrentes.
    Exemplos: salário, aluguel recebido, pensão, renda passiva.

    Espelha o modelo FixedExpense para o lado de receitas.
    """

    description = models.CharField(
        max_length=200, null=False, blank=False, verbose_name="Descrição"
    )
    default_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=False,
        blank=False,
        verbose_name="Valor Padrão",
    )
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
    due_day = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        null=False,
        blank=False,
        verbose_name="Dia de Recebimento",
        help_text="Dia do mês em que a receita costuma ser recebida (1-31)",
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Ativa",
        help_text="Desmarque para desativar sem excluir",
    )
    allow_value_edit = models.BooleanField(
        default=True,
        verbose_name="Permitir Editar Valor",
        help_text="Permite ajustar o valor ao lançar a receita",
    )
    member = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        verbose_name="Membro Responsável",
        null=True,
        blank=True,
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
        verbose_name = "Receita Fixa"
        verbose_name_plural = "Receitas Fixas"
        indexes = [
            models.Index(fields=["account", "is_active"]),
            models.Index(fields=["due_day", "is_active"]),
        ]

    def __str__(self):
        return f"{self.description} - Dia {self.due_day}"


class FixedRevenueGenerationLog(BaseModel):
    """Histórico de geração de receitas fixas por mês. Previne duplicação."""

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
    fixed_revenue_ids = models.JSONField(
        default=list,
        verbose_name="IDs das Receitas Fixas",
        help_text="Lista de IDs dos templates que foram gerados",
    )

    class Meta:
        ordering = ["-month"]
        verbose_name = "Log de Geração de Receitas Fixas"
        verbose_name_plural = "Logs de Geração de Receitas Fixas"

    def __str__(self):
        return (
            f"Geração Receitas {self.month} - {self.total_generated} receitas"
        )
