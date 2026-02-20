from django.urls import path

from . import views

urlpatterns = [
    path(
        "revenues/", views.RevenueCreateListView.as_view(), name="revenue-create-list"
    ),
    path(
        "revenues/<int:pk>/",
        views.RevenueRetrieveUpdateDestroyView.as_view(),
        name="revenue-detail-view",
    ),
]
