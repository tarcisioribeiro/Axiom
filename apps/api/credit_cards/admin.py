from django.contrib import admin

from credit_cards.models import (
    CreditCard,
    CreditCardBill,
    CreditCardInstallment,
    CreditCardPurchase,
)


@admin.register(CreditCard)
class CreditCardAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "flag")


@admin.register(CreditCardBill)
class CreditCardBillAdmin(admin.ModelAdmin):
    list_display = ("year", "month")


@admin.register(CreditCardPurchase)
class CreditCardPurchaseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "description",
        "total_value",
        "purchase_date",
        "card",
        "total_installments",
    )


@admin.register(CreditCardInstallment)
class CreditCardInstallmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "purchase",
        "installment_number",
        "value",
        "due_date",
        "bill",
        "payed",
    )
