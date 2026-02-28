from django.urls import path

from .views import (
    AccountBalancesView,
    BalanceForecastView,
    CashFlowForecastView,
    CreditCardExpensesByCategoryView,
    DashboardStatsView,
    MonthlyStatementView,
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
    path(
        "monthly-statement/",
        MonthlyStatementView.as_view(),
        name="monthly-statement",
    ),
    path(
        "cash-flow-forecast/",
        CashFlowForecastView.as_view(),
        name="cash-flow-forecast",
    ),
]
