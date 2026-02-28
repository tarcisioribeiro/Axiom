from django.urls import path

from .views import (
    AccountBalancesView,
    BalanceForecastView,
    CreditCardExpensesByCategoryView,
    DashboardStatsView,
)

urlpatterns = [
    path("stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("account-balances/", AccountBalancesView.as_view(), name="account-balances"),
    path(
        "credit-card-expenses-by-category/",
        CreditCardExpensesByCategoryView.as_view(),
        name="credit-card-expenses-by-category",
    ),
    path("balance-forecast/", BalanceForecastView.as_view(), name="balance-forecast"),
]
