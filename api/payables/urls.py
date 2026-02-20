from django.urls import path

from . import views

urlpatterns = [
    path(
        "payables/", views.PayableCreateListView.as_view(), name="payable-create-list"
    ),
    path(
        "payables/<int:pk>/",
        views.PayableRetrieveUpdateDestroyView.as_view(),
        name="payable-detail-view",
    ),
]
