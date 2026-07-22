"""
Tools do agente pessoal: treino, nutrição e evolução física.
Complementa planning_tools.py com dados de workout e meal log.
"""

from datetime import date, timedelta
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone


def get_workout_summary(
    user: User,
    days: int = 7,
    start: date | None = None,
    end: date | None = None,
) -> dict[str, Any]:
    """Resumo das sessões de treino num período."""
    try:
        from personal_planning.models import WorkoutSession

        today = timezone.now().date()
        if start is not None and end is not None:
            period_start, period_end = start, end
        else:
            period_end = today
            period_start = period_end - timedelta(days=days - 1)

        sessions = list(
            WorkoutSession.objects.filter(
                owner__user=user,
                date__range=(period_start, period_end),
                is_deleted=False,
            ).values(
                "date",
                "workout_day__name",
                "started_at",
                "finished_at",
                "notes",
            )
        )

        result = []
        for s in sessions[:15]:
            duration = None
            if s["started_at"] and s["finished_at"]:
                from datetime import datetime

                start_dt = datetime.combine(s["date"], s["started_at"])
                end_dt = datetime.combine(s["date"], s["finished_at"])
                mins = max(0, int((end_dt - start_dt).total_seconds() / 60))
                duration = f"{mins} min"
            result.append(
                {
                    "date": s["date"].strftime("%d/%m/%Y"),
                    "plan": s["workout_day__name"] or "Avulso",
                    "duration": duration,
                    "notes": s["notes"] or "",
                }
            )

        return {
            "total_sessions": len(sessions),
            "days_analyzed": (period_end - period_start).days + 1,
            "sessions": result,
            "period_start": period_start.strftime("%d/%m"),
            "period_end": period_end.strftime("%d/%m/%Y"),
        }
    except Exception:
        return {
            "total_sessions": 0,
            "days_analyzed": days,
            "sessions": [],
            "period_start": "",
            "period_end": "",
        }


def get_nutrition_summary(
    user: User,
    days: int = 7,
    start: date | None = None,
    end: date | None = None,
) -> dict[str, Any]:
    """Resumo do diário alimentar num período."""
    try:
        from personal_planning.models import MealLog

        today = timezone.now().date()
        if start is not None and end is not None:
            period_start, period_end = start, end
        else:
            period_end = today
            period_start = period_end - timedelta(days=days - 1)

        logs = list(
            MealLog.objects.filter(
                owner__user=user,
                date__range=(period_start, period_end),
                is_deleted=False,
            ).values(
                "date",
                "meal_type__name",
                "menu_option__name",
                "is_free_meal",
                "notes",
            )
        )

        free_meals = sum(1 for entry in logs if entry["is_free_meal"])
        recent = [
            {
                "date": (
                    entry["date"].strftime("%d/%m/%Y") if entry["date"] else ""
                ),
                "meal": entry["meal_type__name"] or "Refeição",
                "option": entry["menu_option__name"] or "Livre",
                "free": entry["is_free_meal"],
            }
            for entry in logs[:12]
        ]

        return {
            "total_logs": len(logs),
            "free_meals": free_meals,
            "days_analyzed": (period_end - period_start).days + 1,
            "recent": recent,
            "period_start": period_start.strftime("%d/%m"),
            "period_end": period_end.strftime("%d/%m/%Y"),
        }
    except Exception:
        return {
            "total_logs": 0,
            "free_meals": 0,
            "days_analyzed": days,
            "recent": [],
            "period_start": "",
            "period_end": "",
        }


def get_active_workout_plan(user: User) -> dict[str, Any]:
    """Retorna o plano de treino ativo e seus dias."""
    try:
        from personal_planning.models import WorkoutDay, WorkoutPlan

        plan = (
            WorkoutPlan.objects.filter(owner__user=user, is_deleted=False)
            .order_by("-created_at")
            .first()
        )
        if not plan:
            return {"has_plan": False}

        days = list(
            WorkoutDay.objects.filter(plan=plan, is_deleted=False)
            .values("name", "muscle_groups", "order")
            .order_by("order")
        )
        return {
            "has_plan": True,
            "plan_name": plan.name,
            "days": [
                {
                    "name": d["name"],
                    "muscle_groups": (d["muscle_groups"] or "")[:100],
                }
                for d in days
            ],
        }
    except Exception:
        return {"has_plan": False}
