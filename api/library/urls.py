from django.urls import path

from library.views import (  # noqa: E501  # Author/Publisher/Book/Summary/Reading/ReadingGoal/Highlight/Dashboard views
    AuthorDetailView,
    AuthorListCreateView,
    BookDetailView,
    BookFileStreamView,
    BookFileView,
    BookHighlightDetailView,
    BookHighlightExportView,
    BookHighlightListCreateView,
    BookListCreateView,
    BookMarkAsReadView,
    BookReadingQueueView,
    BookReorderView,
    LibraryDashboardStatsView,
    LiteraryTypeGoalDetailView,
    LiteraryTypeGoalListCreateView,
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
    path("books/<int:pk>/file/", BookFileView.as_view(), name="book-file"),
    path(
        "books/<int:pk>/file/stream/",
        BookFileStreamView.as_view(),
        name="book-file-stream",
    ),
    path(
        "books/<int:pk>/mark-as-read/",
        BookMarkAsReadView.as_view(),
        name="book-mark-as-read",
    ),
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
    # Literary Type Goals
    path(
        "literary-type-goals/",
        LiteraryTypeGoalListCreateView.as_view(),
        name="literary-type-goal-list-create",
    ),
    path(
        "literary-type-goals/<int:pk>/",
        LiteraryTypeGoalDetailView.as_view(),
        name="literary-type-goal-detail",
    ),
    # Book Highlights
    path(
        "highlights/",
        BookHighlightListCreateView.as_view(),
        name="highlight-list-create",
    ),
    path(
        "highlights/export/",
        BookHighlightExportView.as_view(),
        name="highlight-export",
    ),
    path(
        "highlights/<int:pk>/",
        BookHighlightDetailView.as_view(),
        name="highlight-detail",
    ),
]
