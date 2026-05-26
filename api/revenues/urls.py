from django.urls import path

from . import views

urlpatterns = [
    path(
        "revenues/export/",
        views.ExportRevenuesView.as_view(),
        name="revenue-export",
    ),
    path(
        "revenues/",
        views.RevenueCreateListView.as_view(),
        name="revenue-create-list",
    ),
    path(
        "revenues/<int:pk>/",
        views.RevenueRetrieveUpdateDestroyView.as_view(),
        name="revenue-detail-view",
    ),
    # Fixed Revenue endpoints
    path(
        "fixed-revenues/stats/",
        views.FixedRevenuesStatsView.as_view(),
        name="fixed-revenue-stats",
    ),
    path(
        "fixed-revenues/generate/",
        views.BulkGenerateFixedRevenuesView.as_view(),
        name="fixed-revenue-generate",
    ),
    path(
        "fixed-revenues/",
        views.FixedRevenueListCreateView.as_view(),
        name="fixed-revenue-list-create",
    ),
    path(
        "fixed-revenues/<int:pk>/",
        views.FixedRevenueDetailView.as_view(),
        name="fixed-revenue-detail",
    ),
]
