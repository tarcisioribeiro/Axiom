"""
Tools de segurança — metadados apenas, NUNCA expõe valores criptografados.
Segue a regra: o agente de segurança jamais retorna senhas, PINs ou chaves.
"""

from datetime import timedelta
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone


def get_security_overview(user: User) -> dict[str, Any]:
    """Contagens e metadados gerais do módulo de segurança."""
    try:
        from security.models import (
            Archive,
            Password,
            StoredBankAccount,
            StoredCreditCard,
        )

        owner_filter: dict[str, Any] = {
            "owner__user": user,
            "is_deleted": False,
        }

        password_count = Password.objects.filter(**owner_filter).count()
        card_count = StoredCreditCard.objects.filter(**owner_filter).count()
        account_count = StoredBankAccount.objects.filter(
            **owner_filter
        ).count()
        archive_count = Archive.objects.filter(**owner_filter).count()

        # Senhas sem atualização há mais de 180 dias
        old_threshold = timezone.now() - timedelta(days=180)
        old_passwords = Password.objects.filter(
            **owner_filter,
            last_password_change__lt=old_threshold,
        ).count()

        # Senhas atualizadas recentemente (últimos 30 dias)
        recent_threshold = timezone.now() - timedelta(days=30)
        recent_updates = Password.objects.filter(
            **owner_filter,
            last_password_change__gte=recent_threshold,
        ).count()

        return {
            "passwords": password_count,
            "stored_cards": card_count,
            "stored_accounts": account_count,
            "archives": archive_count,
            "old_passwords": old_passwords,
            "recently_updated": recent_updates,
        }
    except Exception:
        return {
            "passwords": 0,
            "stored_cards": 0,
            "stored_accounts": 0,
            "archives": 0,
            "old_passwords": 0,
            "recently_updated": 0,
        }


def get_recent_activity(user: User, limit: int = 15) -> list[dict[str, Any]]:
    """Últimos N eventos de segurança do usuário (sem dados sensíveis)."""
    try:
        from security.models import ActivityLog

        logs = list(
            ActivityLog.objects.filter(user=user)
            .order_by("-created_at")
            .values(
                "action",
                "model_name",
                "description",
                "ip_address",
                "created_at",
            )[:limit]
        )
        return [
            {
                "action": log["action"],
                "model": log["model_name"] or "",
                "description": (log["description"] or "")[:120],
                "ip": log["ip_address"] or "",
                "when": (
                    log["created_at"].strftime("%d/%m/%Y %H:%M")
                    if log["created_at"]
                    else ""
                ),
            }
            for log in logs
        ]
    except Exception:
        return []


def get_password_categories(user: User) -> list[dict[str, Any]]:
    """
    Distribuição de senhas por categoria (contagens apenas, sem conteúdo).
    """
    try:
        from django.db.models import Count

        from security.models import Password

        cats = list(
            Password.objects.filter(owner__user=user, is_deleted=False)
            .values("category")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        return [
            {"category": c["category"] or "Sem categoria", "count": c["count"]}
            for c in cats
        ]
    except Exception:
        return []
