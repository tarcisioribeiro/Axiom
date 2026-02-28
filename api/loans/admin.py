from django.contrib import admin

from loans.models import Loan


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ("id", "description", "date", "value", "benefited")
