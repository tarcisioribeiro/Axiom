from django.urls import path

from . import views

urlpatterns = [
    # Expense endpoints
    path(
        "expenses/export/",
        views.ExportExpensesView.as_view(),
        name="expense-export",
    ),
    path(
        "expenses/", views.ExpenseCreateListView.as_view(), name="expense-create-list"
    ),
    path(
        "expenses/<int:pk>/",
        views.ExpenseRetrieveUpdateDestroyView.as_view(),
        name="expense-detail-view",
    ),
    # Fixed Expense endpoints
    path(
        "fixed-expenses/",
        views.FixedExpenseListCreateView.as_view(),
        name="fixed-expense-list-create",
    ),
    path(
        "fixed-expenses/<int:pk>/",
        views.FixedExpenseDetailView.as_view(),
        name="fixed-expense-detail",
    ),
    # Bulk operations
    path(
        "fixed-expenses/generate/",
        views.BulkGenerateFixedExpensesView.as_view(),
        name="fixed-expense-generate",
    ),
    path(
        "expenses/bulk-mark-paid/",
        views.BulkMarkPaidView.as_view(),
        name="expense-bulk-mark-paid",
    ),
    # Statistics
    path(
        "fixed-expenses/stats/",
        views.FixedExpensesStatsView.as_view(),
        name="fixed-expense-stats",
    ),
    # Categorization Rules — apply/ must come before <int:pk>/
    path(
        "categorization-rules/apply/",
        views.ApplyCategorizationRulesView.as_view(),
        name="categorization-rule-apply",
    ),
    path(
        "categorization-rules/",
        views.CategorizationRuleListCreateView.as_view(),
        name="categorization-rule-list",
    ),
    path(
        "categorization-rules/<int:pk>/",
        views.CategorizationRuleRetrieveUpdateDestroyView.as_view(),
        name="categorization-rule-detail",
    ),
]
