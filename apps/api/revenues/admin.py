from django.contrib import admin

from revenues.models import Revenue


@admin.register(Revenue)
class RevenueAdmin(admin.ModelAdmin):
    list_display = ("id", "description", "date", "horary", "value")
