from django.contrib import admin

from budgets.models import Budget


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = (
        "category",
        "month",
        "year",
        "limit_amount",
        "member",
        "is_deleted",
    )
    list_filter = ("month", "year", "category", "is_deleted")
    search_fields = ("category", "member__name")
    ordering = ("-year", "-month", "category")
