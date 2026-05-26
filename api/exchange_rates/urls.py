from django.urls import path

from exchange_rates.views import ConvertCurrencyView, LatestRatesView

urlpatterns = [
    path(
        "exchange-rates/",
        LatestRatesView.as_view(),
        name="exchange-rates-latest",
    ),
    path(
        "exchange-rates/convert/",
        ConvertCurrencyView.as_view(),
        name="exchange-rates-convert",
    ),
]
