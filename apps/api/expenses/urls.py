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
        "expenses/suggest-category/",
        views.ExpenseSuggestCategoryView.as_view(),
        name="expense-suggest-category",
    ),
    path(
        "expenses/ocr/",
        views.ExpenseOCRView.as_view(),
        name="expense-ocr",
    ),
    path(
        "expenses/",
        views.ExpenseCreateListView.as_view(),
        name="expense-create-list",
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
        "fixed-expenses/generated-months/",
        views.FixedExpensesGeneratedMonthsView.as_view(),
        name="fixed-expense-generated-months",
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
    # Tags
    path("tags/", views.TagListCreateView.as_view(), name="tag-list-create"),
    path("tags/<int:pk>/", views.TagDetailView.as_view(), name="tag-detail"),
    # Automation Rules
    path(
        "automation-rules/apply/",
        views.AutomationRuleApplyView.as_view(),
        name="automation-rule-apply",
    ),
    path(
        "automation-rules/",
        views.AutomationRuleListCreateView.as_view(),
        name="automation-rule-list",
    ),
    path(
        "automation-rules/<int:pk>/",
        views.AutomationRuleRetrieveUpdateDestroyView.as_view(),
        name="automation-rule-detail",
    ),
    path(
        "automation-rules/<int:pk>/logs/",
        views.AutomationRuleLogListView.as_view(),
        name="automation-rule-logs",
    ),
    # Fixed Expense Generation Log
    path(
        "fixed-expenses/generation-log/",
        views.FixedExpenseGenerationLogListView.as_view(),
        name="fixed-expense-generation-log",
    ),
    # Expense Splits
    path(
        "expenses/<int:pk>/splits/",
        views.ExpenseSplitListCreateView.as_view(),
        name="expense-splits",
    ),
]
