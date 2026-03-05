from django.urls import path

from library.views import (  # noqa: E501  # Author/Publisher/Book/Summary/Reading/ReadingGoal/Dashboard views
    AuthorDetailView,
    AuthorListCreateView,
    BookDetailView,
    BookListCreateView,
    BookReadingQueueView,
    BookReorderView,
    LibraryDashboardStatsView,
    PublisherDetailView,
    PublisherListCreateView,
    ReadingDetailView,
    ReadingGoalDetailView,
    ReadingGoalListCreateView,
    ReadingListCreateView,
    SummaryDetailView,
    SummaryListCreateView,
)

urlpatterns = [
    # Dashboard
    path(
        "dashboard/stats/",
        LibraryDashboardStatsView.as_view(),
        name="library-dashboard-stats",
    ),
    # Authors
    path("authors/", AuthorListCreateView.as_view(), name="author-list-create"),
    path("authors/<int:pk>/", AuthorDetailView.as_view(), name="author-detail"),
    # Publishers
    path(
        "publishers/", PublisherListCreateView.as_view(), name="publisher-list-create"
    ),
    path(
        "publishers/<int:pk>/", PublisherDetailView.as_view(), name="publisher-detail"
    ),
    # Books
    path("books/", BookListCreateView.as_view(), name="book-list-create"),
    path("books/<int:pk>/", BookDetailView.as_view(), name="book-detail"),
    # Reading Queue
    path("reading-queue/", BookReadingQueueView.as_view(), name="reading-queue"),
    path(
        "reading-queue/reorder/",
        BookReorderView.as_view(),
        name="reading-queue-reorder",
    ),
    # Summaries
    path("summaries/", SummaryListCreateView.as_view(), name="summary-list-create"),
    path("summaries/<int:pk>/", SummaryDetailView.as_view(), name="summary-detail"),
    # Readings
    path("readings/", ReadingListCreateView.as_view(), name="reading-list-create"),
    path("readings/<int:pk>/", ReadingDetailView.as_view(), name="reading-detail"),
    # Reading Goals
    path(
        "reading-goals/",
        ReadingGoalListCreateView.as_view(),
        name="reading-goal-list-create",
    ),
    path(
        "reading-goals/<int:pk>/",
        ReadingGoalDetailView.as_view(),
        name="reading-goal-detail",
    ),
]
