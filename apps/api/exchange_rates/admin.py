from django.contrib import admin

from exchange_rates.models import ExchangeRate


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = [
        "currency_from",
        "rate_sell",
        "rate_buy",
        "mid_rate",
        "reference_date",
        "source",
    ]
    list_filter = ["currency_from", "source"]
    ordering = ["-reference_date", "currency_from"]
    date_hierarchy = "reference_date"
