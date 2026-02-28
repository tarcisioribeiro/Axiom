from django.contrib import admin

from payables.models import Payable


@admin.register(Payable)
class PayableAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "description",
        "value",
        "paid_value",
        "status",
        "date",
        "due_date",
    )
    list_filter = ("status", "category")
    search_fields = ("description", "notes")
    ordering = ("-date",)
