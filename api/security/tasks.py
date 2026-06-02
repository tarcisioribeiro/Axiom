"""
Security periodic tasks.
"""

import logging
from calendar import monthrange
from datetime import date

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def check_stored_card_expiry() -> dict:
    """
    Verifica cartões armazenados vencendo em ≤30 dias e cria notificações
    in-app para o proprietário.

    Usa (owner, notification_type, content_type, object_id) como chave
    natural de deduplicação — um registro por cartão.

    Roda diariamente às 09h via beat_schedule em app/celery.py.
    """
    from notifications.models import Notification
    from security.models import StoredCreditCard

    today = date.today()
    created = 0
    skipped = 0

    for card in StoredCreditCard.objects.filter(
        is_deleted=False,
        deleted_at__isnull=True,
    ).select_related("owner", "owner__user"):
        last_day = monthrange(card.expiration_year, card.expiration_month)[1]
        expiry_date = date(
            card.expiration_year, card.expiration_month, last_day
        )
        days_remaining = (expiry_date - today).days

        if days_remaining > 60 or days_remaining < 0:
            continue

        threshold = "30 dias" if days_remaining <= 30 else "60 dias"

        already_exists = Notification.objects.filter(
            owner=card.owner,
            notification_type="stored_card_expiring",
            content_type="StoredCreditCard",
            object_id=card.id,
        ).exists()

        if already_exists:
            skipped += 1
            continue

        Notification.objects.create(
            owner=card.owner,
            notification_type="stored_card_expiring",
            title=f"Cartão '{card.name}' vence em {threshold}",
            message=(
                f"O cartão {card.name} ({card.flag}) armazenado no cofre"
                f" vence em {days_remaining} dia(s)"
                f" ({card.expiration_month:02d}/{card.expiration_year})."
                " Atualize ou remova o cartão no Cofre de Segurança."
            ),
            content_type="StoredCreditCard",
            object_id=card.id,
            created_by=card.owner.user,
            updated_by=card.owner.user,
        )
        created += 1
        logger.info(
            "Notificação de vencimento criada: cartão=%s owner=%s days=%s",
            card.id,
            card.owner_id,
            days_remaining,
        )

    return {"created": created, "skipped": skipped}
