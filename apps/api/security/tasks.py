"""
Security periodic tasks.
"""

import logging
from calendar import monthrange
from datetime import date, timedelta

from django.utils import timezone

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


@shared_task
def notify_compromised_passwords() -> dict:
    """
    Cria notificações in-app para senhas marcadas como comprometidas pelo HIBP
    que ainda não foram trocadas.

    Roda semanalmente via beat_schedule. Não precisa de acesso ao cofre —
    apenas lê o flag hibp_compromised salvo durante o health report.
    """
    from notifications.models import Notification
    from security.models import Password

    created = 0
    skipped = 0

    compromised_qs = Password.objects.filter(
        hibp_compromised=True,
        is_deleted=False,
        deleted_at__isnull=True,
    ).select_related("owner", "owner__user")

    for pw in compromised_qs:
        already = Notification.objects.filter(
            owner=pw.owner,
            notification_type="vault_breach_detected",
            content_type="Password",
            object_id=pw.id,
        ).exists()
        if already:
            skipped += 1
            continue

        Notification.objects.create(
            owner=pw.owner,
            notification_type="vault_breach_detected",
            title=f"Senha '{pw.title}' encontrada em vazamento",
            message=(
                f"A senha de '{pw.title}' foi detectada em um banco"
                " de dados de credenciais vazadas. Troque-a"
                " imediatamente no Cofre de Segurança."
            ),
            content_type="Password",
            object_id=pw.id,
            created_by=pw.owner.user,
            updated_by=pw.owner.user,
        )
        created += 1
        logger.info(
            "Notificação HIBP criada: password=%s owner=%s", pw.id, pw.owner_id
        )

    return {"created": created, "skipped": skipped}


@shared_task
def send_weekly_security_summary() -> dict:
    """
    Envia resumo semanal de segurança do cofre para cada membro.

    Usa os VaultHealthSnapshot da última semana para agregar tendência
    de score. Cria notificação in-app e e-mail (se configurado).

    Roda toda segunda-feira às 09h via beat_schedule.
    """
    from members.models import Member
    from notifications.models import Notification
    from security.models import VaultHealthSnapshot

    week_ago = timezone.now() - timedelta(days=7)
    sent = 0

    for member in Member.objects.filter(user__is_active=True).select_related(
        "user"
    ):
        snapshots = list(
            VaultHealthSnapshot.objects.filter(
                owner=member, snapshot_date__gte=week_ago.date()
            ).order_by("snapshot_date")
        )
        if not snapshots:
            continue

        latest = snapshots[-1]
        oldest = snapshots[0]
        trend = latest.score - oldest.score
        trend_label = (
            "melhorou" if trend > 0 else ("piorou" if trend < 0 else "estável")
        )

        already = Notification.objects.filter(
            owner=member,
            notification_type="vault_weekly_report",
            created_at__gte=week_ago,
        ).exists()
        if already:
            continue

        score_emoji = (
            "🟢"
            if latest.score >= 80
            else ("🟡" if latest.score >= 50 else "🔴")
        )
        message = (
            f"Score atual: {latest.score}/100 {score_emoji}. "
            f"Tendência na semana: {trend_label} ({trend:+d} pts). "
            f"Senhas fracas: {latest.weak_passwords}, "
            f"duplicadas: {latest.duplicate_passwords}, "
            f"desatualizadas: {latest.outdated_passwords}."
        )

        Notification.objects.create(
            owner=member,
            notification_type="vault_weekly_report",
            title="Resumo semanal de segurança do Cofre",
            message=message,
            created_by=member.user,
            updated_by=member.user,
        )
        sent += 1
        logger.info(
            "Resumo semanal enviado para member=%s score=%s",
            member.id,
            latest.score,
        )

    return {"sent": sent}


@shared_task
def detect_activity_anomalies() -> dict:
    """
    Detecta padrões anômalos no ActivityLog (múltiplas falhas, acessos
    fora do horário habitual) e cria notificações in-app.

    Roda diariamente às 06h.
    """
    from datetime import timedelta

    from django.db.models import Count

    from notifications.models import Notification
    from notifications.services import dispatch_notification
    from security.models import ActivityLog

    since = timezone.now() - timedelta(hours=24)
    flagged = 0

    # Detectar múltiplas tentativas de unlock com falha (≥3 em 24h)
    failed_unlocks = (
        ActivityLog.objects.filter(
            action="failed_vault_unlock",
            created_at__gte=since,
        )
        .values("user")
        .annotate(count=Count("id"))
        .filter(count__gte=3)
    )

    for item in failed_unlocks:
        if not item["user"]:
            continue
        try:
            from members.models import Member

            member = Member.objects.get(user_id=item["user"])
        except Member.DoesNotExist:
            continue

        already = Notification.objects.filter(
            owner=member,
            notification_type="vault_anomaly_detected",
            created_at__gte=since,
        ).exists()
        if already:
            continue

        notif = Notification.objects.create(
            owner=member,
            notification_type="vault_anomaly_detected",
            title="Atividade suspeita detectada no Cofre",
            message=(
                f"Foram detectadas {item['count']} tentativas de"
                " desbloqueio com falha nas últimas 24 horas. Verifique"
                " se sua conta foi comprometida."
            ),
            content_type="ActivityLog",
            object_id=0,
            created_by=member.user,
            updated_by=member.user,
        )
        dispatch_notification(notif)
        flagged += 1
        logger.info(
            "Anomalia detectada para member=%s (%d falhas)",
            member.id,
            item["count"],
        )

    return {"flagged": flagged}


@shared_task
def check_vault_alert_rules() -> dict:
    """
    Verifica regras de alerta do cofre configuradas por usuário.

    Executada a cada 15 minutos via beat_schedule.
    Regras verificadas:
    - alert_on_excessive_reveals: > N reveals em 1 hora
    - alert_on_card_reveal: qualquer reveal de cartão bancário
    - alert_on_failed_unlock: N+ falhas de desbloqueio desde última hora
    """
    from notifications.models import Notification
    from security.models import ActivityLog, VaultAlertConfig

    now = timezone.now()
    one_hour_ago = now - timedelta(hours=1)
    triggered = 0

    for config in VaultAlertConfig.objects.filter(
        is_deleted=False
    ).select_related("owner", "owner__user"):
        member = config.owner
        user = member.user

        # Rule 1: excessive reveals in 1 hour
        if config.alert_on_excessive_reveals:
            reveal_actions = [
                "password_reveal",
                "card_reveal",
                "account_reveal",
            ]
            reveal_count = ActivityLog.objects.filter(
                user=user,
                action__in=reveal_actions,
                created_at__gte=one_hour_ago,
            ).count()
            threshold = config.excessive_reveals_threshold or 5
            if reveal_count >= threshold:
                already = Notification.objects.filter(
                    owner=member,
                    notification_type="vault_anomaly_detected",
                    title__icontains="volume",
                    created_at__gte=one_hour_ago,
                    is_deleted=False,
                ).exists()
                if not already:
                    _create_vault_alert(
                        member,
                        user,
                        "Volume excessivo de revelações detectado",
                        (
                            f"Foram detectadas {reveal_count} revelações"
                            f" nas últimas 60 minutos"
                            f" (limite: {threshold})."
                            " Verifique os logs para mais detalhes."
                        ),
                        config.notify_email,
                    )
                    triggered += 1

        # Rule 2: bank card reveal
        if config.alert_on_card_reveal:
            card_reveals = ActivityLog.objects.filter(
                user=user,
                action="card_reveal",
                created_at__gte=one_hour_ago,
            ).count()
            if card_reveals > 0:
                already = Notification.objects.filter(
                    owner=member,
                    notification_type="vault_anomaly_detected",
                    title__icontains="cartão",
                    created_at__gte=one_hour_ago,
                    is_deleted=False,
                ).exists()
                if not already:
                    _create_vault_alert(
                        member,
                        user,
                        "Cartão bancário revelado no Cofre",
                        (
                            f"Um ou mais cartões bancários foram revelados"
                            f" recentemente ({card_reveals}x na última hora)."
                            " Se não foi você, revogue o acesso imediatamente."
                        ),
                        config.notify_email,
                    )
                    triggered += 1

        # Rule 3: failed unlock attempts
        if config.alert_on_failed_unlock:
            threshold = config.failed_unlock_threshold or 3
            failed = ActivityLog.objects.filter(
                user=user,
                action="failed_vault_unlock",
                created_at__gte=one_hour_ago,
            ).count()
            if failed >= threshold:
                already = Notification.objects.filter(
                    owner=member,
                    notification_type="vault_anomaly_detected",
                    title__icontains="desbloqueio",
                    created_at__gte=one_hour_ago,
                    is_deleted=False,
                ).exists()
                if not already:
                    _create_vault_alert(
                        member,
                        user,
                        "Tentativas de desbloqueio do Cofre com falha",
                        (
                            f"Foram detectadas {failed} tentativas"
                            f" de desbloqueio com falha na última hora"
                            f" (limite: {threshold})."
                            " Verifique se sua conta foi comprometida."
                        ),
                        config.notify_email,
                    )
                    triggered += 1

    logger.info("check_vault_alert_rules: %d regras disparadas", triggered)
    return {"triggered": triggered}


def _create_vault_alert(
    member, user, title: str, message: str, notify_email: bool
):
    """Cria notificação in-app e opcionalmente envia e-mail."""
    from notifications.models import Notification

    notif = Notification.objects.create(
        owner=member,
        notification_type="vault_anomaly_detected",
        title=title,
        message=message,
        content_type="ActivityLog",
        object_id=0,
        created_by=user,
        updated_by=user,
    )
    if notify_email and user.email:
        try:
            from django.core.mail import send_mail

            send_mail(
                subject=f"[Axiom Cofre] {title}",
                message=(
                    f"Olá {user.first_name or user.username},\n\n"
                    f"{message}\n\n"
                    "Acesse o Cofre de Segurança para mais detalhes.\n\n"
                    "— Axiom Security"
                ),
                from_email=None,
                recipient_list=[user.email],
                fail_silently=True,
            )
        except Exception:
            pass
    return notif
