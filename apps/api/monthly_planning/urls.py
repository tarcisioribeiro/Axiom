from django.urls import path

from monthly_planning.views import (
    MonthlyPlanApplyView,
    MonthlyPlanDetailView,
    MonthlyPlanSummaryView,
)

urlpatterns = [
    path(
        "monthly-plan/summary/",
        MonthlyPlanSummaryView.as_view(),
        name="monthly-plan-summary",
    ),
    path(
        "monthly-plan/<int:pk>/",
        MonthlyPlanDetailView.as_view(),
        name="monthly-plan-detail",
    ),
    path(
        "monthly-plan/<int:pk>/apply/",
        MonthlyPlanApplyView.as_view(),
        name="monthly-plan-apply",
    ),
]
