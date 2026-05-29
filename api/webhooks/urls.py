from django.urls import path

from webhooks.views import (
    WebhookDeliveryListView,
    WebhookEventChoicesView,
    WebhookListCreateView,
    WebhookRetrieveUpdateDestroyView,
    WebhookTestView,
)

urlpatterns = [
    path(
        "webhooks/",
        WebhookListCreateView.as_view(),
        name="webhook-list-create",
    ),
    path(
        "webhooks/events/",
        WebhookEventChoicesView.as_view(),
        name="webhook-events",
    ),
    path(
        "webhooks/<int:pk>/",
        WebhookRetrieveUpdateDestroyView.as_view(),
        name="webhook-detail",
    ),
    path(
        "webhooks/<int:pk>/deliveries/",
        WebhookDeliveryListView.as_view(),
        name="webhook-deliveries",
    ),
    path(
        "webhooks/<int:pk>/test/",
        WebhookTestView.as_view(),
        name="webhook-test",
    ),
]
