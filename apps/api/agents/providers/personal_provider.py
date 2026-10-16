"""
Ponto único de acesso ao ORM de `personal_planning` a partir de `agents/`.

Só este pacote (`agents/providers/`) importa models de outros apps — o
restante de `agents/` (tools, agents de domínio, views) consome estas
funções. Ver documentation/architecture/agents-llm-boundary.md.
"""

from datetime import date
from typing import Any

from django.contrib.auth.models import User
from django.db.models import Count

from agents.providers.access import requires_screen


@requires_screen("planning.tasks_goals", "planning.weekly", empty=[])
def task_instances_status(
    user: User, start: date, end: date
) -> list[dict[str, Any]]:
    from personal_planning.models import TaskInstance

    qs: Any = TaskInstance.objects.filter(
        owner__user=user,
        scheduled_date__range=(start, end),
        is_deleted=False,
    ).values("status")
    return list(qs)


@requires_screen("planning.tasks_goals", "planning.weekly", empty=[])
def missed_task_instances_by_template(
    user: User, start: date, end: date, limit: int = 5
) -> list[dict[str, Any]]:
    from personal_planning.models import TaskInstance

    qs: Any = (
        TaskInstance.objects.filter(
            owner__user=user,
            scheduled_date__range=(start, end),
            is_deleted=False,
        )
        .exclude(status="completed")
        .values("template__name", "template__category")
        .annotate(miss_count=Count("id"))
        .order_by("-miss_count")[:limit]
    )
    return list(qs)


@requires_screen("planning.tasks_goals", empty=[])
def active_goals(user: User, limit: int = 10) -> list[dict[str, Any]]:
    from personal_planning.models import Goal

    rows: Any = Goal.objects.filter(
        owner__user=user,
        status="active",
        is_deleted=False,
    ).values(
        "title", "goal_type", "target_value", "current_value", "end_date"
    )[
        :limit
    ]
    return list(rows)


@requires_screen("planning.tasks_goals", "planning.weekly", empty=[])
def today_pending_task_instances(
    user: User, today: date, limit: int = 10
) -> list[dict[str, Any]]:
    from personal_planning.models import TaskInstance

    rows: Any = TaskInstance.objects.filter(
        owner__user=user,
        scheduled_date=today,
        status="pending",
        is_deleted=False,
    ).values("template__name", "template__category", "template__icon")[:limit]
    return list(rows)


@requires_screen("planning.workout", empty=[])
def workout_sessions(
    user: User, start: date, end: date
) -> list[dict[str, Any]]:
    from personal_planning.models import WorkoutSession

    rows: Any = WorkoutSession.objects.filter(
        owner__user=user,
        date__range=(start, end),
        is_deleted=False,
    ).values(
        "date",
        "workout_day__name",
        "started_at",
        "finished_at",
        "notes",
    )
    return list(rows)


@requires_screen("planning.nutrition", empty=[])
def meal_logs(user: User, start: date, end: date) -> list[dict[str, Any]]:
    from personal_planning.models import MealLog

    rows: Any = MealLog.objects.filter(
        owner__user=user,
        date__range=(start, end),
        is_deleted=False,
    ).values(
        "date",
        "meal_type__name",
        "menu_option__name",
        "is_free_meal",
        "notes",
    )
    return list(rows)


@requires_screen("planning.workout", empty=None)
def active_workout_plan_with_days(user: User) -> dict[str, Any] | None:
    """Plano de treino mais recente do usuário e seus dias, ou None se não
    houver plano."""
    from personal_planning.models import WorkoutDay, WorkoutPlan

    plan = (
        WorkoutPlan.objects.filter(owner__user=user, is_deleted=False)
        .order_by("-created_at")
        .first()
    )
    if not plan:
        return None

    days = list(
        WorkoutDay.objects.filter(plan=plan, is_deleted=False)
        .values("name", "muscle_groups", "order")
        .order_by("order")
    )
    return {"plan_name": plan.name, "days": days}
