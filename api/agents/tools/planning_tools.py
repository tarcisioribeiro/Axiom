from datetime import date, timedelta
from typing import Any

from django.contrib.auth.models import User
from django.db.models import Count
from django.utils import timezone


def get_routine_summary(
    user: User,
    days: int = 7,
    start: date | None = None,
    end: date | None = None,
) -> dict[str, Any]:
    """Summary of routine completion for a period.

    If start/end are provided they take precedence over days.
    """
    from personal_planning.models import TaskInstance

    if start is not None and end is not None:
        period_start, period_end = start, end
    else:
        period_end = timezone.now().date()
        period_start = period_end - timedelta(days=days - 1)

    instances = TaskInstance.objects.filter(
        owner__user=user,
        scheduled_date__range=(period_start, period_end),
        is_deleted=False,
    ).values("status")

    total = len(instances)
    completed = sum(1 for i in instances if i["status"] == "completed")
    skipped = sum(1 for i in instances if i["status"] == "skipped")
    pending = sum(1 for i in instances if i["status"] == "pending")

    completion_rate = (completed / total * 100) if total > 0 else 0

    return {
        "period_days": (period_end - period_start).days + 1,
        "total": total,
        "completed": completed,
        "skipped": skipped,
        "pending": pending,
        "completion_rate": round(completion_rate, 1),
        "start": period_start.strftime("%d/%m"),
        "end": period_end.strftime("%d/%m/%Y"),
    }


def get_top_missed_routines(
    user: User,
    days: int = 7,
    start: date | None = None,
    end: date | None = None,
) -> list[dict[str, Any]]:
    """Routines with the highest failure count in the period."""
    from personal_planning.models import TaskInstance

    if start is not None and end is not None:
        period_start, period_end = start, end
    else:
        period_end = timezone.now().date()
        period_start = period_end - timedelta(days=days - 1)

    missed = (
        TaskInstance.objects.filter(
            owner__user=user,
            scheduled_date__range=(period_start, period_end),
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
    """Active goals with progress."""
    from personal_planning.models import Goal

    goals = Goal.objects.filter(
        owner__user=user,
        status="active",
        is_deleted=False,
    ).values(
        "title", "goal_type", "target_value", "current_value", "end_date"
    )[
        :10
    ]

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
                    g["end_date"].strftime("%d/%m/%Y")
                    if g["end_date"]
                    else None
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
