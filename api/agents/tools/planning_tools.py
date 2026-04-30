from datetime import timedelta
from typing import Any

from django.contrib.auth.models import User
from django.db.models import Count
from django.utils import timezone


def get_routine_summary(user: User, days: int = 7) -> dict[str, Any]:
    """Resumo de cumprimento de rotinas nos últimos N dias."""
    from personal_planning.models import TaskInstance

    end = timezone.now().date()
    start = end - timedelta(days=days - 1)

    instances = TaskInstance.objects.filter(
        owner__user=user,
        scheduled_date__range=(start, end),
        is_deleted=False,
    ).values("status")

    total = len(instances)
    completed = sum(1 for i in instances if i["status"] == "completed")
    skipped = sum(1 for i in instances if i["status"] == "skipped")
    pending = sum(1 for i in instances if i["status"] == "pending")

    completion_rate = (completed / total * 100) if total > 0 else 0

    return {
        "period_days": days,
        "total": total,
        "completed": completed,
        "skipped": skipped,
        "pending": pending,
        "completion_rate": round(completion_rate, 1),
        "start": start.strftime("%d/%m"),
        "end": end.strftime("%d/%m/%Y"),
    }


def get_top_missed_routines(user: User, days: int = 7) -> list[dict[str, Any]]:
    """Rotinas com maior taxa de falha."""
    from personal_planning.models import TaskInstance

    end = timezone.now().date()
    start = end - timedelta(days=days - 1)

    missed = (
        TaskInstance.objects.filter(
            owner__user=user,
            scheduled_date__range=(start, end),
            is_deleted=False,
        )
        .exclude(status="completed")
        .values("template__name", "template__category")
        .annotate(miss_count=Count("id"))
        .order_by("-miss_count")[:5]
    )

    return [
        {
            "name": m["template__name"],  # type: ignore[index]
            "category": m["template__category"],  # type: ignore[index]
            "missed": m["miss_count"],  # type: ignore[index]
        }
        for m in missed
    ]


def get_active_goals(user: User) -> list[dict[str, Any]]:
    """Metas ativas com progresso."""
    from personal_planning.models import Goal

    goals = Goal.objects.filter(
        owner__user=user,
        status="active",
        is_deleted=False,
    ).values("title", "goal_type", "target_value", "current_value", "deadline")[:10]

    result = []
    for g in goals:
        target = float(g["target_value"] or 1)
        current = float(g["current_value"] or 0)
        pct = min(current / target * 100, 100) if target > 0 else 0
        result.append(
            {
                "title": g["title"],
                "goal_type": g["goal_type"],
                "progress_pct": round(pct, 1),
                "target": target,
                "current": current,
                "target_date": (
                    g["deadline"].strftime("%d/%m/%Y") if g["deadline"] else None
                ),
            }
        )
    return result


def get_today_pending_tasks(user: User) -> list[dict[str, Any]]:
    from personal_planning.models import TaskInstance

    today = timezone.now().date()
    pending = TaskInstance.objects.filter(
        owner__user=user,
        scheduled_date=today,
        status="pending",
        is_deleted=False,
    ).values("template__name", "template__category", "template__icon")[:10]

    return [
        {
            "name": t["template__name"],
            "category": t["template__category"],
            "icon": t["template__icon"],
        }
        for t in pending
    ]
