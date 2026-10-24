"""
Etapas da revisão diária: o que conta como pendente em cada uma, as telas que
dão acesso a ela e as justificativas aceitas para pulá-la.

Etapas "por dia" olham uma data específica (reflexão de ontem, treino de
ontem...). Etapas "contínuas" (``window_days``) olham o estado atual (bem-estar
na última semana, flashcards vencidos) e aparecem só na revisão do dia mais
recente; a justificativa delas vale até o fim da janela.

O texto das justificativas fica no frontend
(``dailyReview.justifications.<etapa>.<código>``); aqui só os códigos.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from django.db.models import QuerySet, Sum
from django.utils import timezone

from library.models import Course, CourseSession, FlashCard
from members.models import Member
from personal_planning.models import (
    BodyMetric,
    DailyReflection,
    EmotionalCheckin,
    Goal,
    GoalFailure,
    HydrationGoal,
    MealLog,
    MealType,
    SelfEsteemAssessment,
    TaskInstance,
    WaterLog,
    WellnessInterventionCompletion,
    WorkoutDay,
    WorkoutSession,
)

SKIP = "skip"
KEEP = "keep_pending"

Item = dict[str, Any]


@dataclass
class Context:
    member: Member
    today: date
    self_esteem_frequency_days: int = 1


@dataclass(frozen=True)
class Step:
    key: str
    screens: tuple[str, ...]
    # Ação de tela exigida para registrar pelo modal (None = só justificar)
    register_action: str | None
    # código → ação (pular / manter pendente)
    justifications: dict[str, str]
    collect: Callable[[Context, date], list[Item]]
    # Etapa contínua: janela, em dias, em que a justificativa vale
    window_days: int | None = None
    # Etapa por dia que só vale em certas condições (ex.: autoestima diária)
    enabled: Callable[[Context], bool] = field(default=lambda ctx: True)
    # Há algo a cobrar? Usado no lote de dias antigos, sem varrer cada dia.
    applies: Callable[[Context], bool] = field(default=lambda ctx: True)


def _single(missing: bool) -> list[Item]:
    return [{"key": "", "label": ""}] if missing else []


# ---------------------------------------------------------------------------
# Coletores (etapas por dia)
# ---------------------------------------------------------------------------


def _reflection(ctx: Context, day: date) -> list[Item]:
    return _single(
        not DailyReflection.objects.filter(
            owner=ctx.member, date=day, is_deleted=False
        ).exists()
    )


def _tasks(ctx: Context, day: date) -> list[Item]:
    from personal_planning.services.instance_generator import (
        InstanceGenerator,
    )

    # Instâncias são geradas sob demanda: sem isso, um dia em que o usuário
    # não abriu o app não teria tarefas a revisar.
    InstanceGenerator.generate_for_date(ctx.member, day)
    # Tarefas vinculadas a refeição/hidratação/treino já são cobradas nas
    # etapas "meals"/"hydration"/"workout" — listá-las aqui também duplicaria
    # a pendência.
    qs = (
        TaskInstance.objects.filter(
            owner=ctx.member,
            scheduled_date=day,
            status__in=("pending", "in_progress"),
            is_deleted=False,
        )
        .exclude(template__linked_meal_type__isnull=False)
        .exclude(template__linked_hydration_goal__isnull=False)
        .exclude(template__linked_workout=True)
        .order_by("scheduled_time", "occurrence_index")
    )
    return [
        {
            "key": str(t.uuid),
            "label": t.task_name,
            "id": t.id,
            "time": (
                t.scheduled_time.strftime("%H:%M")
                if t.scheduled_time
                else None
            ),
        }
        for t in qs
    ]


def _avoid_habit_goals(ctx: Context) -> QuerySet[Goal]:
    return Goal.objects.filter(
        owner=ctx.member,
        goal_type="avoid_habit",
        status="active",
        is_deleted=False,
    )


def _goals(ctx: Context, day: date) -> list[Item]:
    failed = GoalFailure.objects.filter(failure_date=day).values("goal_id")
    qs = (
        _avoid_habit_goals(ctx)
        .filter(start_date__lte=day)
        .exclude(id__in=failed)
    )
    return [{"key": str(g.uuid), "label": g.title, "id": g.id} for g in qs]


# Mesma ordem usada em "Plano de hoje" e no dropdown de registro de sessão
# (DIVISION_CATEGORY_ORDER em apps/web/src/lib/workout-calendar.ts).
_WORKOUT_CATEGORY_ORDER = {"mobility": 0, "resistance": 1, "cardio": 2}


def _planned_workout_days(ctx: Context, day: date) -> list[WorkoutDay]:
    days = WorkoutDay.objects.filter(
        owner=ctx.member,
        plan__is_active=True,
        plan__is_deleted=False,
        is_deleted=False,
    ).select_related("plan")
    today_days = [d for d in days if day.weekday() in (d.days_of_week or [])]
    return sorted(
        today_days,
        key=lambda d: _WORKOUT_CATEGORY_ORDER.get(
            d.plan.category, len(_WORKOUT_CATEGORY_ORDER)
        ),
    )


def _workouts(ctx: Context, day: date) -> list[Item]:
    done = set(
        WorkoutSession.objects.filter(
            owner=ctx.member, date=day, is_deleted=False
        ).values_list("workout_day_id", flat=True)
    )
    return [
        {
            "key": str(d.uuid),
            "label": d.name,
            "id": d.id,
            "plan": d.plan.name,
        }
        for d in _planned_workout_days(ctx, day)
        if d.id not in done
    ]


def _active_meal_types(ctx: Context) -> QuerySet[MealType]:
    return MealType.objects.filter(
        owner=ctx.member, is_active=True, is_deleted=False
    ).order_by("order", "suggested_time")


def _meals(ctx: Context, day: date) -> list[Item]:
    logged = set(
        MealLog.objects.filter(
            owner=ctx.member, date=day, is_deleted=False
        ).values_list("meal_type_id", flat=True)
    )
    return [
        {
            "key": str(m.uuid),
            "label": m.name,
            "id": m.id,
            "time": (
                m.suggested_time.strftime("%H:%M")
                if m.suggested_time
                else None
            ),
        }
        for m in _active_meal_types(ctx)
        if m.id not in logged
    ]


def _hydration_goal(ctx: Context) -> HydrationGoal | None:
    return HydrationGoal.objects.filter(
        owner=ctx.member, is_deleted=False
    ).first()


def _hydration(ctx: Context, day: date) -> list[Item]:
    goal = _hydration_goal(ctx)
    if not goal:
        return []
    total = (
        WaterLog.objects.filter(
            owner=ctx.member, date=day, is_deleted=False
        ).aggregate(total=Sum("amount_ml"))["total"]
        or 0
    )
    if total >= goal.daily_target_ml:
        return []
    return [
        {
            "key": "",
            "label": "",
            "total_ml": total,
            "target_ml": goal.daily_target_ml,
        }
    ]


def _checkin(ctx: Context, day: date) -> list[Item]:
    return _single(
        not EmotionalCheckin.objects.filter(
            owner=ctx.member, checked_at=day, is_deleted=False
        ).exists()
    )


def _self_esteem_daily(ctx: Context, day: date) -> list[Item]:
    return _single(
        not SelfEsteemAssessment.objects.filter(
            owner=ctx.member, assessed_at=day, is_deleted=False
        ).exists()
    )


def _scheduled_courses(ctx: Context) -> QuerySet[Course]:
    return Course.objects.filter(
        owner=ctx.member, status="in_progress", is_deleted=False
    ).exclude(study_weekdays=[])


def _study(ctx: Context, day: date) -> list[Item]:
    studied = set(
        CourseSession.objects.filter(
            owner=ctx.member, session_date=day, is_deleted=False
        ).values_list("course_id", flat=True)
    )
    return [
        {"key": str(c.uuid), "label": c.title, "id": c.id}
        for c in _scheduled_courses(ctx)
        if day.weekday() in c.study_weekdays and c.id not in studied
    ]


# ---------------------------------------------------------------------------
# Coletores (etapas contínuas — ``day`` é o dia de hoje)
# ---------------------------------------------------------------------------


def _self_esteem_window(ctx: Context, day: date) -> list[Item]:
    since = day - timedelta(days=ctx.self_esteem_frequency_days)
    return _single(
        not SelfEsteemAssessment.objects.filter(
            owner=ctx.member, assessed_at__gt=since, is_deleted=False
        ).exists()
    )


def _wellness(ctx: Context, day: date) -> list[Item]:
    since = timezone.now() - timedelta(days=7)
    return _single(
        not WellnessInterventionCompletion.objects.filter(
            owner=ctx.member, completed_at__gte=since, is_deleted=False
        ).exists()
    )


def _weigh_in(ctx: Context, day: date) -> list[Item]:
    return _single(
        not BodyMetric.objects.filter(
            owner=ctx.member,
            measured_at__gt=day - timedelta(days=7),
            weight_kg__isnull=False,
            is_deleted=False,
        ).exists()
    )


def _flashcards(ctx: Context, day: date) -> list[Item]:
    count = FlashCard.objects.filter(
        owner=ctx.member, next_review__lte=day, is_deleted=False
    ).count()
    return [{"key": "", "label": "", "count": count}] if count else []


# ---------------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------------

_DAILY_SELF_ESTEEM: Callable[[Context], bool] = (
    lambda ctx: ctx.self_esteem_frequency_days == 1
)

STEPS: tuple[Step, ...] = (
    Step(
        "reflection",
        ("planning.reflections",),
        "add",
        {"forgot": SKIP, "no_time": SKIP, "nothing_to_add": SKIP},
        _reflection,
    ),
    Step(
        "tasks",
        ("planning.tasks_goals", "planning.weekly"),
        "change",
        {
            "no_time": SKIP,
            "not_needed": SKIP,
            "health": SKIP,
            "postponed": KEEP,
        },
        _tasks,
        applies=lambda ctx: ctx.member.routine_tasks.filter(
            is_active=True, is_deleted=False
        ).exists(),
    ),
    Step(
        "goals",
        ("planning.tasks_goals",),
        "change",
        {"avoided": SKIP, "not_applicable": SKIP},
        _goals,
        applies=lambda ctx: _avoid_habit_goals(ctx).exists(),
    ),
    Step(
        "workout",
        ("planning.workout",),
        "add",
        {
            "rest": SKIP,
            "no_time": SKIP,
            "health": SKIP,
            "other_activity": SKIP,
        },
        _workouts,
        applies=lambda ctx: WorkoutDay.objects.filter(
            owner=ctx.member, plan__is_active=True, is_deleted=False
        )
        .exclude(days_of_week=[])
        .exists(),
    ),
    Step(
        "meals",
        ("planning.nutrition",),
        "add",
        {"skipped_meal": SKIP, "forgot_to_log": SKIP, "fasting": SKIP},
        _meals,
        applies=lambda ctx: _active_meal_types(ctx).exists(),
    ),
    Step(
        "hydration",
        ("planning.nutrition",),
        "add",
        {"forgot_to_log": SKIP, "below_goal": SKIP, "health": SKIP},
        _hydration,
        applies=lambda ctx: _hydration_goal(ctx) is not None,
    ),
    Step(
        "checkin",
        ("planning.wellness",),
        "add",
        {"forgot": SKIP, "no_time": SKIP, "prefer_not": SKIP},
        _checkin,
    ),
    Step(
        "self_esteem",
        ("planning.wellness",),
        "add",
        {"forgot": SKIP, "no_time": SKIP, "prefer_not": SKIP},
        _self_esteem_daily,
        enabled=_DAILY_SELF_ESTEEM,
    ),
    Step(
        "study",
        ("intellect.courses",),
        "add",
        {
            "no_time": SKIP,
            "rest": SKIP,
            "health": SKIP,
            "rescheduled": SKIP,
        },
        _study,
        applies=lambda ctx: _scheduled_courses(ctx).exists(),
    ),
    # Contínuas
    Step(
        "self_esteem_periodic",
        ("planning.wellness",),
        "add",
        {"forgot": SKIP, "no_time": SKIP, "prefer_not": SKIP},
        _self_esteem_window,
        window_days=-1,  # resolvida pela frequência do usuário
        enabled=lambda ctx: not _DAILY_SELF_ESTEEM(ctx),
    ),
    Step(
        "wellness",
        ("planning.wellness",),
        "add",
        {"no_time": SKIP, "feeling_well": SKIP, "will_do_soon": SKIP},
        _wellness,
        window_days=7,
    ),
    Step(
        "weigh_in",
        ("planning.body_metrics",),
        "add",
        {"no_scale": SKIP, "away": SKIP, "will_measure_soon": SKIP},
        _weigh_in,
        window_days=7,
    ),
    Step(
        "flashcards",
        ("intellect.flashcards",),
        None,
        {"review_later": SKIP, "no_time": SKIP, "paused_studies": SKIP},
        _flashcards,
        window_days=1,
    ),
)

STEPS_BY_KEY = {s.key: s for s in STEPS}


def window_of(step: Step, ctx: Context) -> int:
    if step.window_days == -1:
        return ctx.self_esteem_frequency_days
    return step.window_days or 0
