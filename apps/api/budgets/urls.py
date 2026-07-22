from django.urls import path

from . import views

urlpatterns = [
    path(
        "budgets/",
        views.BudgetListCreateView.as_view(),
        name="budget-list-create",
    ),
    path(
        "budgets/<int:pk>/",
        views.BudgetDetailView.as_view(),
        name="budget-detail",
    ),
    path(
        "budgets/status/",
        views.BudgetStatusView.as_view(),
        name="budget-status",
    ),
    path(
        "budgets/history/",
        views.BudgetHistoryView.as_view(),
        name="budget-history",
    ),
    path(
        "budgets/suggest/",
        views.BudgetSuggestView.as_view(),
        name="budget-suggest",
    ),
]
