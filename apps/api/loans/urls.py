from django.urls import path

from . import views

urlpatterns = [
    path(
        "loans/", views.LoanCreateListView.as_view(), name="loan-create-list"
    ),
    path(
        "loans/<int:pk>/",
        views.LoanRetrieveUpdateDestroyView.as_view(),
        name="loan-detail-view",
    ),
    path(
        "loans/<int:pk>/installments/",
        views.LoanInstallmentListView.as_view(),
        name="loan-installments",
    ),
    path(
        "loans/<int:pk>/pay/",
        views.LoanPaymentView.as_view(),
        name="loan-payment",
    ),
    path(
        "loans/<int:pk>/receive/",
        views.LoanReceiptView.as_view(),
        name="loan-receipt",
    ),
    path(
        "loans/<int:pk>/amortization/",
        views.LoanAmortizationView.as_view(),
        name="loan-amortization",
    ),
]
