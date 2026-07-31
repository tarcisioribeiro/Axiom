"""
Ponto único de acesso ao ORM de `security` a partir de `agents/`.

Só este pacote (`agents/providers/`) importa models de outros apps — o
restante de `agents/` (tools, agents de domínio, views) consome estas
funções. Ver documentation/architecture/agents-llm-boundary.md.
"""

from datetime import timedelta
from typing import Any, cast

from django.contrib.auth.models import User
from django.utils import timezone


def security_counts(user: User) -> dict[str, int]:
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

    old_threshold = timezone.now() - timedelta(days=180)
    recent_threshold = timezone.now() - timedelta(days=30)

    return {
        "passwords": Password.objects.filter(**owner_filter).count(),
        "stored_cards": StoredCreditCard.objects.filter(
            **owner_filter
        ).count(),
        "stored_accounts": StoredBankAccount.objects.filter(
            **owner_filter
        ).count(),
        "archives": Archive.objects.filter(**owner_filter).count(),
        "old_passwords": Password.objects.filter(
            **owner_filter,
            last_password_change__lt=old_threshold,
        ).count(),
        "recently_updated": Password.objects.filter(
            **owner_filter,
            last_password_change__gte=recent_threshold,
        ).count(),
    }


def recent_activity_logs(user: User, limit: int = 15) -> list[dict[str, Any]]:
    from security.models import ActivityLog

    rows: Any = (
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
    return list(rows)


def password_category_counts(user: User) -> list[dict[str, Any]]:
    from django.db.models import Count

    from security.models import Password

    return cast(
        "list[dict[str, Any]]",
        list(
            Password.objects.filter(owner__user=user, is_deleted=False)
            .values("category")
            .annotate(count=Count("id"))
            .order_by("-count")
        ),
    )


def valid_password_categories() -> set[str]:
    from security.models import PASSWORD_CATEGORIES

    return {c[0] for c in PASSWORD_CATEGORIES}
