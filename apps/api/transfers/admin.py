from django.contrib import admin

from transfers.models import Transfer


@admin.register(Transfer)
class TransferAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "description",
        "value",
        "date",
        "origin_account",
        "destiny_account",
    )
