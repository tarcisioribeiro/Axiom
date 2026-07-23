from datetime import date, timedelta
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from agents.providers import personal_provider


def get_routine_summary(
    user: User,
    days: int = 7,
    start: date | None = None,
    end: date | None = None,
) -> dict[str, Any]:
    """Summary of routine completion for a period.

    If start/end are provided they take precedence over days.
    """
    if start is not None and end is not None:
        period_start, period_end = start, end
    else:
        period_end = timezone.now().date()
        period_start = period_end - timedelta(days=days - 1)

    instances = personal_provider.task_instances_status(
        user, period_start, period_end
    )

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
    if start is not None and end is not None:
        period_start, period_end = start, end
    else:
        period_end = timezone.now().date()
        period_start = period_end - timedelta(days=days - 1)

    missed = personal_provider.missed_task_instances_by_template(
        user, period_start, period_end, limit=5
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
    goals = personal_provider.active_goals(user, limit=10)

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
    today = timezone.now().date()
    pending = personal_provider.today_pending_task_instances(
        user, today, limit=10
    )

    return [
        {
            "name": t["template__name"],
            "category": t["template__category"],
            "icon": t["template__icon"],
        }
        for t in pending
    ]
