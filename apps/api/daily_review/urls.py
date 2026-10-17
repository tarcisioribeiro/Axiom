from django.urls import path

from .views import (
    DailyReviewBacklogView,
    DailyReviewCompleteView,
    DailyReviewResolveView,
    DailyReviewView,
)

urlpatterns = [
    path("daily-review/", DailyReviewView.as_view(), name="daily-review"),
    path(
        "daily-review/resolve/",
        DailyReviewResolveView.as_view(),
        name="daily-review-resolve",
    ),
    path(
        "daily-review/backlog/",
        DailyReviewBacklogView.as_view(),
        name="daily-review-backlog",
    ),
    path(
        "daily-review/complete/",
        DailyReviewCompleteView.as_view(),
        name="daily-review-complete",
    ),
]
