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
    # Fixed Transfer endpoints
    path(
        "fixed-transfers/generate/",
        views.BulkGenerateFixedTransfersView.as_view(),
        name="fixed-transfer-generate",
    ),
    path(
        "fixed-transfers/",
        views.FixedTransferListCreateView.as_view(),
        name="fixed-transfer-list-create",
    ),
    path(
        "fixed-transfers/<int:pk>/",
        views.FixedTransferDetailView.as_view(),
        name="fixed-transfer-detail",
    ),
]
