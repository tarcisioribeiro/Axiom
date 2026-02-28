from django.urls import path

from . import views

urlpatterns = [
    path(
        "transfers/",
        views.TransferCreateListView.as_view(),
        name="transfer-create-list",
    ),
    path(
        "transfers/<int:pk>/",
        views.TransferRetrieveUpdateDestroyView.as_view(),
        name="transfer-detail-view",
    ),
]
