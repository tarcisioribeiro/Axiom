from django.urls import path

from . import views

urlpatterns = [
    path(
        "payables/",
        views.PayableCreateListView.as_view(),
        name="payable-create-list",
    ),
    path(
        "payables/<int:pk>/",
        views.PayableRetrieveUpdateDestroyView.as_view(),
        name="payable-detail-view",
    ),
    path(
        "payables/<int:pk>/installments/",
        views.PayableInstallmentListView.as_view(),
        name="payable-installments",
    ),
    path(
        "payables/<int:pk>/pay/",
        views.PayablePaymentView.as_view(),
        name="payable-payment",
    ),
]
