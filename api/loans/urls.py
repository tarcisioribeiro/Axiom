from django.urls import path

from . import views

urlpatterns = [
    path("loans/", views.LoanCreateListView.as_view(), name="loan-create-list"),
    path(
        "loans/<int:pk>/",
        views.LoanRetrieveUpdateDestroyView.as_view(),
        name="loan-detail-view",
    ),
]
