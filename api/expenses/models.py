from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from accounts.models import Account
from app.models import PAYMENT_FREQUENCY_CHOICES, PAYMENT_METHOD_CHOICES, BaseModel

EXPENSES_CATEGORIES = (
    ("food and drink", "Comida e bebida"),
    ("bills and services", "Contas e serviços"),
    ("electronics", "Eletrônicos"),
    ("family and friends", "Amizades e Família"),
    ("pets", "Animais de estimação"),
    ("digital signs", "Assinaturas digitais"),
    ("house", "Casa"),
    ("purchases", "Compras"),
    ("donate", "Doações"),
    ("education", "Educação"),
    ("loans", "Empréstimos"),
    ("entertainment", "Entretenimento"),
    ("taxes", "Impostos"),
    ("investments", "Investimentos"),
    ("others", "Outros"),
    ("vestuary", "Roupas"),
    ("health and care", "Saúde e cuidados pessoais"),
    ("professional services", "Serviços profissionais"),
    ("supermarket", "Supermercado"),
    ("rates", "Taxas"),
    ("transport", "Transporte"),
    ("travels", "Viagens"),
)


class Expense(BaseModel):
    description = models.CharField(
        max_length=100, null=False, blank=False, verbose_name="Descrição"
    )
    value = models.DecimalField(
        null=False, blank=False, verbose_name="Valor", max_digits=10, decimal_places=2
    )
    date = models.DateField(verbose_name="Data", null=False, blank=False)
    horary = models.TimeField(verbose_name="Horário", null=False, blank=False)
    category = models.CharField(
        verbose_name="Categoria",
        max_length=200,
        choices=EXPENSES_CATEGORIES,
        null=False,
        blank=False,
    )
    account = models.ForeignKey(
        Account,
        max_length=200,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Conta",
    )
    payed = models.BooleanField(verbose_name="Pago", default=False)
    merchant = models.CharField(
        max_length=200, verbose_name="Estabelecimento", null=True, blank=True
    )
    location = models.CharField(
        max_length=200, verbose_name="Local da Compra", null=True, blank=True
    )
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        verbose_name="Método de Pagamento",
        null=True,
        blank=True,
    )
    receipt = models.FileField(
        upload_to="expenses/receipts/",
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
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)
    recurring = models.BooleanField(verbose_name="Despesa Recorrente", default=False)
    frequency = models.CharField(
        max_length=20,
        choices=PAYMENT_FREQUENCY_CHOICES,
        verbose_name="Frequência",
        null=True,
        blank=True,
        help_text="Apenas se for recorrente",
    )
    related_transfer = models.ForeignKey(
        "transfers.Transfer",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="generated_expense",
        verbose_name="Transferência Relacionada",
        help_text="Transferência que gerou esta despesa automaticamente",
    )
    fixed_expense_template = models.ForeignKey(
        "FixedExpense",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_expenses",
        verbose_name="Modelo de Despesa Fixa",
        help_text="Template de despesa fixa que gerou esta despesa",
    )
    related_loan = models.ForeignKey(
        "loans.Loan",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_expenses",
        verbose_name="Empréstimo Relacionado",
        help_text=(
            "Empréstimo que esta despesa está pagando"
            " (quando você deve e está pagando)"
        ),
    )
    related_bill_payment = models.ForeignKey(
        "credit_cards.CreditCardBill",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_expenses",
        verbose_name="Fatura de Cartão Relacionada",
        help_text="Fatura de cartão de crédito que esta despesa está pagando",
    )
    related_payable = models.ForeignKey(
        "payables.Payable",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_expenses",
        verbose_name="Valor a Pagar Relacionado",
        help_text="Valor a pagar que esta despesa está abatendo",
    )

    class Meta:
        ordering = ["-date"]
        verbose_name = "Despesa"
        verbose_name_plural = "Despesas"
        indexes = [
            models.Index(fields=["-date"]),
            models.Index(fields=["category", "date"]),
            models.Index(fields=["account", "date"]),
            models.Index(fields=["payed", "date"]),
            models.Index(fields=["account", "category"]),
            models.Index(fields=["related_transfer"]),
            models.Index(fields=["related_loan"]),
            models.Index(fields=["related_bill_payment"]),
            models.Index(fields=["related_payable"]),
        ]

    def __str__(self):
        return f"{self.description} - {self.date}, {self.horary}"


class FixedExpense(BaseModel):
    """
    Template para despesas fixas mensais recorrentes.
    Exemplos: aluguel, condomínio, assinaturas, seguros.

    Pode ser vinculado a uma conta bancária OU a um cartão de crédito
    (mutuamente exclusivo).
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
        choices=EXPENSES_CATEGORIES,
        null=False,
        blank=False,
        verbose_name="Categoria",
    )
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name="Conta",
        help_text="Conta bancária (se não for despesa de cartão)",
    )
    credit_card = models.ForeignKey(
        "credit_cards.CreditCard",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name="Cartão de Crédito",
        help_text="Cartão de crédito (se não for despesa de conta)",
        related_name="fixed_expenses",
    )
    due_day = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        null=False,
        blank=False,
        verbose_name="Dia de Vencimento",
        help_text="Dia do mês em que a despesa vence (1-31)",
    )
    merchant = models.CharField(
        max_length=200, verbose_name="Estabelecimento", null=True, blank=True
    )
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        verbose_name="Método de Pagamento",
        null=True,
        blank=True,
    )
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)
    member = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        verbose_name="Membro Responsável",
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Ativa",
        help_text="Desmarque para desativar sem excluir",
    )
    allow_value_edit = models.BooleanField(
        default=True,
        verbose_name="Permitir Editar Valor",
        help_text="Permite ajustar o valor ao lançar a despesa",
    )
    last_generated_month = models.CharField(
        max_length=7,
        null=True,
        blank=True,
        verbose_name="Último Mês Gerado",
        help_text="Formato: YYYY-MM",
    )

    class Meta:
        ordering = ["due_day", "description"]
        verbose_name = "Despesa Fixa"
        verbose_name_plural = "Despesas Fixas"
        indexes = [
            models.Index(fields=["account", "is_active"]),
            models.Index(fields=["due_day", "is_active"]),
            models.Index(fields=["credit_card", "is_active"]),
        ]

    def clean(self):
        """Valida que account e credit_card são mutuamente exclusivos"""
        from django.core.exceptions import ValidationError

        # Verifica se ambos estão preenchidos ou ambos estão vazios
        if self.account and self.credit_card:
            _msg = (
                "Não é possível selecionar tanto conta quanto"
                " cartão de crédito. Escolha apenas um."
            )
            raise ValidationError(
                {
                    "account": _msg,
                    "credit_card": _msg,
                }
            )

        if not self.account and not self.credit_card:
            _msg2 = "Selecione uma conta bancária ou um cartão de crédito."
            raise ValidationError(
                {
                    "account": _msg2,
                    "credit_card": _msg2,
                }
            )

    def save(self, *args, **kwargs):
        """Override do save para executar validações"""
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        payment_type = "Cartão" if self.credit_card else "Conta"
        return f"{self.description} - Dia {self.due_day} ({payment_type})"


class FixedExpenseGenerationLog(BaseModel):
    """
    Histórico de geração de despesas fixas por mês.
    Previne duplicação de lançamentos.
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
    fixed_expense_ids = models.JSONField(
        default=list,
        verbose_name="IDs das Despesas Fixas",
        help_text="Lista de IDs dos templates que foram gerados",
    )

    class Meta:
        ordering = ["-month"]
        verbose_name = "Log de Geração"
        verbose_name_plural = "Logs de Geração"

    def __str__(self):
        return f"Geração {self.month} - {self.total_generated} despesas"
