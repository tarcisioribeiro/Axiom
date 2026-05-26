from django.urls import path

from . import views

urlpatterns = [
    path(
        "accounts/",
        views.AccountCreateListView.as_view(),
        name="account-create-list",
    ),
    path(
        "accounts/<int:pk>/",
        views.AccountRetrieveUpdateDestroyView.as_view(),
        name="account-detail-view",
    ),
    path(
        "accounts/<int:pk>/projected-balance/",
        views.AccountProjectedBalanceView.as_view(),
        name="account-projected-balance",
    ),
]
