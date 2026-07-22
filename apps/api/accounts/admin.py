from django.contrib import admin

from accounts.models import Account


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("id", "account_name", "institution_name", "account_type")
