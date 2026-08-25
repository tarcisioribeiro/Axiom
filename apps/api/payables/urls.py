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
    path(
        "payables/<int:pk>/payment-plan/",
        views.PayablePaymentPlanView.as_view(),
        name="payable-payment-plan",
    ),
    path(
        "payables/<int:pk>/increase-value/",
        views.PayableIncreaseValueView.as_view(),
        name="payable-increase-value",
    ),
    path(
        "payables/<int:pk>/recalculate-installments/",
        views.PayableRecalculateInstallmentsView.as_view(),
        name="payable-recalculate-installments",
    ),
    path(
        "payables/<int:pk>/redistribute-after-payment/",
        views.PayableRedistributeAfterPaymentView.as_view(),
        name="payable-redistribute-after-payment",
    ),
]
