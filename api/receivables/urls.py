from django.urls import path

from . import views

urlpatterns = [
    path(
        "receivables/",
        views.ReceivableCreateListView.as_view(),
        name="receivable-create-list",
    ),
    path(
        "receivables/<int:pk>/",
        views.ReceivableRetrieveUpdateDestroyView.as_view(),
        name="receivable-detail-view",
    ),
    path(
        "receivables/<int:pk>/installments/",
        views.ReceivableInstallmentListView.as_view(),
        name="receivable-installments",
    ),
    path(
        "receivables/<int:pk>/receive/",
        views.ReceivableReceiptView.as_view(),
        name="receivable-receipt",
    ),
]
