"""
Utilitário para disparar webhooks de qualquer parte da aplicação.

Uso:
    from webhooks.dispatch import dispatch_event
    dispatch_event("expense.created", {"id": expense.pk}, user=request.user)
"""

from __future__ import annotations

from typing import Any


def dispatch_event(
    event: str, payload: dict[str, Any], user: Any = None
) -> int:
    """
    Cria WebhookDelivery para cada Webhook ativo que assina o evento e
    enfileira a entrega assíncrona via Celery.

    Retorna o número de deliveries criados.
    """
    from webhooks.models import Webhook, WebhookDelivery
    from webhooks.tasks import deliver_webhook

    filters = {"is_active": True, "is_deleted": False}
    if user and hasattr(user, "pk"):
        filters["created_by"] = user

    webhooks = Webhook.objects.filter(**filters)
    count = 0
    for webhook in webhooks:
        if event not in (webhook.events or []):
            continue

        full_payload = {
            "event": event,
            "data": payload,
            "webhook_id": str(webhook.uuid),
        }
        delivery = WebhookDelivery.objects.create(
            webhook=webhook,
            event=event,
            payload=full_payload,
            status="pending",
            created_by=user,
        )
        deliver_webhook.delay(delivery.pk)
        count += 1

    return count
