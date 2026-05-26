from django.contrib import admin

from receivables.models import Receivable, ReceivableInstallment


@admin.register(Receivable)
class ReceivableAdmin(admin.ModelAdmin):
    list_display = [
        "description",
        "value",
        "received_value",
        "status",
        "due_date",
        "created_by",
    ]
    list_filter = ["status", "category"]
    search_fields = ["description"]


@admin.register(ReceivableInstallment)
class ReceivableInstallmentAdmin(admin.ModelAdmin):
    list_display = [
        "receivable",
        "installment_number",
        "value",
        "due_date",
        "received",
    ]
