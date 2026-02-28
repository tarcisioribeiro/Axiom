from django.urls import path

from . import views

urlpatterns = [
    path(
        "revenues/export/",
        views.ExportRevenuesView.as_view(),
        name="revenue-export",
    ),
    path(
        "revenues/", views.RevenueCreateListView.as_view(), name="revenue-create-list"
    ),
    path(
        "revenues/<int:pk>/",
        views.RevenueRetrieveUpdateDestroyView.as_view(),
        name="revenue-detail-view",
    ),
]
