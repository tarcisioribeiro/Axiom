from typing import Any

from django.db.models import QuerySet
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.permissions import GlobalDefaultPermission
from webhooks.models import Webhook
from webhooks.serializers import WebhookDeliverySerializer, WebhookSerializer


class WebhookListCreateView(BaseListCreateView):
    serializer_class = WebhookSerializer

    def get_queryset(self) -> QuerySet[Webhook]:
        return Webhook.objects.filter(
            created_by=self.request.user, is_deleted=False
        ).order_by("-created_at")

    def perform_create(self, serializer: BaseSerializer[Any]) -> None:
        serializer.save(created_by=self.request.user)


class WebhookRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    serializer_class = WebhookSerializer

    def get_queryset(self) -> QuerySet[Webhook]:
        return Webhook.objects.filter(
            created_by=self.request.user, is_deleted=False
        )


class WebhookDeliveryListView(APIView):
    """GET /api/v1/webhooks/{id}/deliveries/ — histórico de entregas."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Webhook.objects.none()

    def get(self, request: Request, pk: int) -> Response:
        webhook = Webhook.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not webhook:
            return Response(
                {"detail": "Não encontrado."}, status=status.HTTP_404_NOT_FOUND
            )

        qs = webhook.deliveries  # type: ignore[attr-defined]
        deliveries = qs.filter(is_deleted=False).order_by("-created_at")[:50]
        serializer = WebhookDeliverySerializer(deliveries, many=True)
        return Response(serializer.data)


class WebhookEventChoicesView(APIView):
    """GET /api/v1/webhooks/events/ — lista de eventos disponíveis."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        from webhooks.models import WEBHOOK_EVENT_CHOICES

        return Response(
            [{"value": v, "label": l} for v, l in WEBHOOK_EVENT_CHOICES]
        )


class WebhookTestView(APIView):
    """POST /api/v1/webhooks/{id}/test/ — envia payload de teste."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Webhook.objects.none()

    def post(self, request: Request, pk: int) -> Response:
        webhook = Webhook.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not webhook:
            return Response(
                {"detail": "Não encontrado."}, status=status.HTTP_404_NOT_FOUND
            )

        # Cria delivery de teste diretamente (sem filtrar por evento)
        from webhooks.models import WebhookDelivery
        from webhooks.tasks import deliver_webhook

        delivery = WebhookDelivery.objects.create(
            webhook=webhook,
            event="test",
            payload={
                "event": "test",
                "data": {"message": "Webhook de teste do Axiom"},
                "webhook_id": str(webhook.uuid),
            },
            status="pending",
            created_by=request.user,
        )
        deliver_webhook.delay(delivery.pk)
        return Response(
            {"detail": "Teste enfileirado.", "delivery_id": delivery.pk}
        )
