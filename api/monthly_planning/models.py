from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from app.models import BaseModel


class MonthlyPlan(BaseModel):
    month = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )
    year = models.PositiveIntegerField(
        validators=[MinValueValidator(2000), MaxValueValidator(2100)]
    )
    extra_revenues = models.JSONField(default=list, blank=True)
    extra_expenses = models.JSONField(default=list, blank=True)
    budget_overrides = models.JSONField(default=dict, blank=True)
    fixed_revenue_overrides = models.JSONField(default=dict, blank=True)
    fixed_expense_overrides = models.JSONField(default=dict, blank=True)
    bill_overrides = models.JSONField(default=dict, blank=True)
    budget_disabled_categories = models.JSONField(default=list, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("month", "year", "created_by")]
        ordering = ["-year", "-month"]

    def __str__(self) -> str:
        return f"MonthlyPlan {self.year}-{self.month:02d}"
