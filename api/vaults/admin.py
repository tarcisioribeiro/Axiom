from django.contrib import admin

from .models import FinancialGoal, Vault, VaultTransaction


@admin.register(Vault)
class VaultAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "description",
        "account",
        "current_balance",
        "accumulated_yield",
        "yield_rate",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "account", "is_deleted")
    search_fields = ("description", "account__account_name")
    readonly_fields = ("uuid", "created_at", "updated_at", "created_by", "updated_by")
    ordering = ("-created_at",)


@admin.register(VaultTransaction)
class VaultTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "vault",
        "transaction_type",
        "amount",
        "balance_after",
        "transaction_date",
        "created_at",
    )
    list_filter = ("transaction_type", "vault", "is_deleted")
    search_fields = ("vault__description", "description")
    readonly_fields = ("uuid", "created_at", "updated_at", "created_by", "updated_by")
    ordering = ("-created_at",)


@admin.register(FinancialGoal)
class FinancialGoalAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "description",
        "category",
        "target_value",
        "is_active",
        "is_completed",
        "created_at",
    )
    list_filter = ("category", "is_active", "is_completed", "is_deleted")
    search_fields = ("description", "notes")
    readonly_fields = (
        "uuid",
        "is_completed",
        "completed_at",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )
    filter_horizontal = ("vaults",)
    ordering = ("-created_at",)
