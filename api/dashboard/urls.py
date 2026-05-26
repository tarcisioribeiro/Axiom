from django.urls import path

from .views import (
    AccountBalancesView,
    AccountReconciliationView,
    AlertsStreamView,
    AnomalyDetectionView,
    AuditLogView,
    BalanceForecastView,
    CashFlowForecastView,
    CreditCardExpensesByCategoryView,
    DashboardStatsView,
    FinancialAlertsView,
    FinancialHealthScoreView,
    IRReportView,
    LGPDExportView,
    MonthlyStatementView,
)

urlpatterns = [
    path("stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path(
        "account-balances/",
        AccountBalancesView.as_view(),
        name="account-balances",
    ),
    path(
        "credit-card-expenses-by-category/",
        CreditCardExpensesByCategoryView.as_view(),
        name="credit-card-expenses-by-category",
    ),
    path(
        "balance-forecast/",
        BalanceForecastView.as_view(),
        name="balance-forecast",
    ),
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
    path(
        "financial-alerts/",
        FinancialAlertsView.as_view(),
        name="financial-alerts",
    ),
    path(
        "anomalies/",
        AnomalyDetectionView.as_view(),
        name="dashboard-anomalies",
    ),
    path(
        "reconciliation/<int:account_id>/",
        AccountReconciliationView.as_view(),
        name="dashboard-reconciliation",
    ),
    path("lgpd-export/", LGPDExportView.as_view(), name="lgpd-export"),
    path("ir-report/", IRReportView.as_view(), name="ir-report"),
    path("alerts/stream/", AlertsStreamView.as_view(), name="alerts-stream"),
    path("audit-log/", AuditLogView.as_view(), name="audit-log"),
    path(
        "health-score/",
        FinancialHealthScoreView.as_view(),
        name="health-score",
    ),
]
