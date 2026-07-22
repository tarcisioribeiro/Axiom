import json
import time
from typing import Any

import requests
from celery import shared_task


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def deliver_webhook(self: Any, delivery_id: int) -> dict:
    """Envia o payload de um WebhookDelivery para a URL configurada."""
    from webhooks.models import WebhookDelivery

    try:
        delivery = WebhookDelivery.objects.select_related("webhook").get(
            pk=delivery_id
        )
    except WebhookDelivery.DoesNotExist:
        return {"error": "delivery not found"}

    webhook = delivery.webhook
    if not webhook.is_active:
        delivery.status = "failed"
        delivery.error_message = "Webhook desativado"
        delivery.save(update_fields=["status", "error_message"])
        return {"skipped": True}

    body = json.dumps(delivery.payload, ensure_ascii=False).encode()
    signature = webhook.sign_payload(body)

    headers = {
        "Content-Type": "application/json",
        "X-Axiom-Event": delivery.event,
        "X-Axiom-Signature": f"sha256={signature}",
        "X-Axiom-Delivery": str(delivery.uuid),
        "User-Agent": "Axiom-Webhook/1.0",
    }

    delivery.status = "retrying"
    delivery.attempt_number = (self.request.retries or 0) + 1
    delivery.save(update_fields=["status", "attempt_number"])

    start = time.monotonic()
    try:
        resp = requests.post(
            webhook.url,
            data=body,
            headers=headers,
            timeout=webhook.timeout_seconds,
        )
        duration_ms = int((time.monotonic() - start) * 1000)

        delivery.response_status_code = resp.status_code
        delivery.response_body = resp.text[:2000]
        delivery.duration_ms = duration_ms

        if resp.ok:
            delivery.status = "success"
            try:
                from app.metrics import record_webhook_delivered

                record_webhook_delivered(delivery.event)
            except Exception:
                pass
        else:
            delivery.status = "failed"
            delivery.error_message = f"HTTP {resp.status_code}"
            try:
                from app.metrics import record_webhook_failed

                record_webhook_failed(delivery.event)
            except Exception:
                pass

        delivery.save(
            update_fields=[
                "status",
                "response_status_code",
                "response_body",
                "duration_ms",
                "error_message",
            ]
        )
        return {"status": delivery.status, "http": resp.status_code}

    except requests.RequestException as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        delivery.duration_ms = duration_ms
        delivery.error_message = str(exc)[:500]
        delivery.save(update_fields=["duration_ms", "error_message"])

        retry_count = self.request.retries or 0
        if retry_count < webhook.max_retries:
            delivery.status = "retrying"
            delivery.save(update_fields=["status"])
            raise self.retry(exc=exc, countdown=60 * (2**retry_count))

        delivery.status = "failed"
        delivery.save(update_fields=["status"])
        return {"status": "failed", "error": str(exc)}
