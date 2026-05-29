from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from app.models import BaseModel
from expenses.models import EXPENSES_CATEGORIES


class Budget(BaseModel):
    """
    Orçamento mensal por categoria de despesa.
    Permite definir um limite de gasto por categoria em um determinado mês/ano.
    """

    category = models.CharField(
        max_length=200,
        choices=EXPENSES_CATEGORIES,
        null=False,
        blank=False,
        verbose_name="Categoria",
    )
    limit_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=False,
        blank=False,
        verbose_name="Valor Limite",
    )
    month = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)],
        null=False,
        blank=False,
        verbose_name="Mês",
    )
    year = models.PositiveIntegerField(
        validators=[MinValueValidator(2000), MaxValueValidator(2100)],
        null=False,
        blank=False,
        verbose_name="Ano",
    )
    member = models.ForeignKey(
        "members.Member",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Membro",
        related_name="budgets",
    )
    rollover_enabled = models.BooleanField(
        default=False,
        verbose_name="Habilitar Rolagem de Saldo",
        help_text=(
            "Quando ativado, o saldo não utilizado do mês anterior"
            " é somado ao limite do mês atual."
        ),
    )
    rollover_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Saldo Rolado",
        help_text=(
            "Valor não utilizado do mês anterior" " acumulado neste orçamento."
        ),
    )

    class Meta:
        ordering = ["year", "month", "category"]
        verbose_name = "Orçamento"
        verbose_name_plural = "Orçamentos"
        constraints = [
            models.UniqueConstraint(
                fields=["category", "month", "year", "member"],
                name="unique_budget_category_month_year_member",
            ),
        ]
        indexes = [
            models.Index(fields=["month", "year"]),
            models.Index(fields=["category", "month", "year"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.category} - {self.month:02d}/{self.year}"
            f" (R$ {self.limit_amount})"
        )
