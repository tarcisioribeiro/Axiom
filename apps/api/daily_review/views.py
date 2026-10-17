from datetime import date, timedelta
from typing import Any, cast

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from admin_panel.access import get_user_actions
from app.request_utils import request_data
from authentication.models import UserPreference
from members.models import Member
from personal_planning.models import TaskInstance

from .models import ReviewProgress, ReviewResolution
from .steps import SKIP, STEPS, STEPS_BY_KEY, Context, Step, window_of

# Dias revisados um a um; os mais antigos são justificados em lote
RECENT_DAYS = 7

Actions = dict[str, set[str]] | None  # None = staff/superuser (tudo)


class Review:
    """Estado da revisão diária de um usuário."""

    def __init__(self, user: User):
        self.member = Member.objects.filter(user=user).first()
        self.today = timezone.localdate()
        self.yesterday = self.today - timedelta(days=1)
        self.actions: Actions = (
            None
            if user.is_staff or user.is_superuser
            else get_user_actions(user)
        )
        pref, _ = UserPreference.objects.get_or_create(user=user)
        self.weekends = pref.daily_review_on_weekends
        if self.member:
            self.ctx = Context(
                self.member, self.today, pref.self_esteem_frequency_days
            )
            joined = timezone.localdate(self.member.created_at)
            self.progress, _ = ReviewProgress.objects.get_or_create(
                owner=self.member,
                defaults={
                    "last_reviewed_date": max(
                        self.today - timedelta(days=2),
                        joined - timedelta(days=1),
                    )
                },
            )

    # -- acesso -----------------------------------------------------------

    def visible(self, step: Step) -> bool:
        if not step.enabled(self.ctx):
            return False
        return self.actions is None or any(
            s in self.actions for s in step.screens
        )

    def can_register(self, step: Step) -> bool:
        action = step.register_action
        if action is None:
            return False
        return self.actions is None or any(
            action in self.actions.get(s, ()) for s in step.screens
        )

    # -- pendências -------------------------------------------------------

    def pending_dates(self) -> list[date]:
        days = []
        day = self.progress.last_reviewed_date + timedelta(days=1)
        while day <= self.yesterday:
            if self.weekends or day.weekday() < 5:
                days.append(day)
            day += timedelta(days=1)
        return days

    def items(self, step: Step, day: date) -> list[dict[str, Any]]:
        """Itens pendentes da etapa (``day`` é ignorado nas contínuas)."""
        if step.window_days:
            recent = ReviewResolution.objects.filter(
                owner=self.member,
                step=step.key,
                reference_date__gt=self.today
                - timedelta(days=window_of(step, self.ctx)),
            )
            return (
                [] if recent.exists() else step.collect(self.ctx, self.today)
            )
        resolved = set(
            ReviewResolution.objects.filter(
                owner=self.member, step=step.key, reference_date=day
            ).values_list("item_key", flat=True)
        )
        return [
            i for i in step.collect(self.ctx, day) if i["key"] not in resolved
        ]

    def serialize_steps(self, day: date, current: bool) -> list[dict]:
        result = []
        for step in STEPS:
            if bool(step.window_days) != current or not self.visible(step):
                continue
            items = self.items(step, day)
            if items:
                result.append(
                    {
                        "key": step.key,
                        "can_register": self.can_register(step),
                        "justifications": list(step.justifications),
                        "items": items,
                    }
                )
        return result

    def backlog_range(self) -> tuple[date, date] | None:
        cutoff = self.today - timedelta(days=RECENT_DAYS)
        old = [d for d in self.pending_dates() if d < cutoff]
        return (old[0], old[-1]) if old else None

    def backlog_steps(self) -> list[Step]:
        return [
            s
            for s in STEPS
            if not s.window_days and self.visible(s) and s.applies(self.ctx)
        ]

    def build(self) -> dict[str, Any]:
        if not self.member:
            return {"backlog": None, "days": []}

        backlog = None
        rng = self.backlog_range()
        if rng:
            steps = self.backlog_steps()
            if steps:
                backlog = {
                    "start": rng[0],
                    "end": rng[1],
                    "days": len(
                        [d for d in self.pending_dates() if d <= rng[1]]
                    ),
                    "steps": [
                        {
                            "key": s.key,
                            "justifications": list(s.justifications),
                        }
                        for s in steps
                    ],
                }
            else:
                self.advance(rng[1])

        days = []
        for day in self.pending_dates():
            if rng and day <= rng[1]:
                continue
            day_steps = self.serialize_steps(day, current=False)
            if day == self.yesterday:
                day_steps += self.serialize_steps(day, current=True)
            if day_steps:
                days.append({"date": day, "steps": day_steps})

        # Fim de semana desligado: ontem não é dia de revisão, mas as etapas
        # contínuas ainda são cobradas uma vez por dia.
        if (
            self.progress.last_reviewed_date < self.yesterday
            and not any(d["date"] == self.yesterday for d in days)
            and self.yesterday not in self.pending_dates()
        ):
            current = self.serialize_steps(self.yesterday, current=True)
            if current:
                days.append({"date": self.yesterday, "steps": current})

        if not backlog and not days:
            self.advance(self.yesterday)
        return {"backlog": backlog, "days": days}

    def advance(self, day: date) -> None:
        if day > self.progress.last_reviewed_date:
            self.progress.last_reviewed_date = day
            self.progress.save(
                update_fields=["last_reviewed_date", "updated_at"]
            )


def _error(detail: str, code: int = status.HTTP_400_BAD_REQUEST) -> Response:
    return Response({"detail": detail}, status=code)


def _parse_date(value: Any) -> date | None:
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


class DailyReviewView(APIView):
    """GET /api/v1/daily-review/ — dias e etapas pendentes do usuário."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        return Response(Review(cast(User, request.user)).build())


def _resolve(
    review: Review, user: User, day: date | None, data: dict[str, Any]
) -> str | None:
    """Justifica um item pendente; devolve a mensagem de erro, se houver."""
    step = STEPS_BY_KEY.get(str(data.get("step")))
    if not review.member or not step or not review.visible(step):
        return "Etapa inválida."
    code = str(data.get("justification"))
    if code not in step.justifications:
        return "Justificativa inválida."
    if not day or not (
        review.progress.last_reviewed_date < day <= review.yesterday
    ):
        return "Data fora da revisão pendente."

    item_key = str(data.get("item_key") or "")
    if item_key not in {i["key"] for i in review.items(step, day)}:
        return "Item não está pendente."

    action = step.justifications[code]
    ReviewResolution.objects.update_or_create(
        owner=review.member,
        step=step.key,
        reference_date=review.today if step.window_days else day,
        item_key=item_key,
        defaults={
            "action": action,
            "justification": code,
            "created_by": user,
            "updated_by": user,
        },
    )
    if step.key == "tasks" and action == SKIP:
        task = TaskInstance.objects.get(owner=review.member, uuid=item_key)
        task.status = "skipped"
        task.save()
    return None


class DailyReviewResolveView(APIView):
    """
    POST /api/v1/daily-review/resolve/
    {step, date, item_key, justification}

    Justifica um item pendente; ele não volta mais (ou até o fim da janela,
    nas etapas contínuas). Tarefa pulada vira ``skipped``.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        user = cast(User, request.user)
        data = request_data(request)
        with transaction.atomic():
            error = _resolve(
                Review(user), user, _parse_date(data.get("date")), data
            )
        if error:
            return _error(error)
        return Response(status=status.HTTP_201_CREATED)


class DailyReviewBacklogView(APIView):
    """
    POST /api/v1/daily-review/backlog/  {justifications: {etapa: código}}

    Justifica de uma vez, por etapa, os dias além dos últimos 7.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        review = Review(cast(User, request.user))
        rng = review.backlog_range() if review.member else None
        if not rng:
            return _error("Não há dias antigos pendentes.")
        given = request_data(request).get("justifications") or {}
        if not isinstance(given, dict):
            return _error("Justificativas inválidas.")
        steps = review.backlog_steps()
        for step in steps:
            if given.get(step.key) not in step.justifications:
                return _error("Justifique todas as etapas.")

        with transaction.atomic():
            ReviewResolution.objects.bulk_create(
                [
                    ReviewResolution(
                        owner=review.member,
                        step=step.key,
                        reference_date=rng[1],
                        item_key="backlog",
                        action=step.justifications[given[step.key]],
                        justification=given[step.key],
                        created_by=request.user,
                        updated_by=request.user,
                    )
                    for step in steps
                ],
                ignore_conflicts=True,
            )
            tasks = STEPS_BY_KEY["tasks"]
            if tasks in steps and tasks.justifications[given["tasks"]] == SKIP:
                # ponytail: update em lote sem signals (XP/metas) — dias
                # antigos não pontuam; trocar por save() se passarem a pontuar.
                TaskInstance.objects.filter(
                    owner=review.member,
                    scheduled_date__range=rng,
                    status__in=("pending", "in_progress"),
                ).update(status="skipped")
            review.advance(rng[1])
        return Response(status=status.HTTP_204_NO_CONTENT)


class DailyReviewCompleteView(APIView):
    """
    POST /api/v1/daily-review/complete/
    {date, resolutions?: [{step, item_key, justification}]}

    Aplica as justificativas do dia e conclui a revisão, tudo ou nada (numa
    só requisição: cada POST invalida todas as queries do frontend). Recusa
    se ainda houver item pendente nele ou em dia anterior.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        user = cast(User, request.user)
        data = request_data(request)
        review = Review(user)
        day = _parse_date(data.get("date"))
        if not review.member or not day:
            return _error("Data inválida.")
        if not (review.progress.last_reviewed_date < day <= review.yesterday):
            return _error("Data fora da revisão pendente.")
        resolutions = data.get("resolutions") or []
        if not isinstance(resolutions, list):
            return _error("Justificativas inválidas.")

        with transaction.atomic():
            for item in resolutions:
                error = _resolve(
                    review, user, day, item if isinstance(item, dict) else {}
                )
                if error:
                    transaction.set_rollback(True)
                    return _error(error)
            state = review.build()
            pending = sum(
                len(s["items"])
                for d in state["days"]
                if d["date"] <= day
                for s in d["steps"]
            )
            if state["backlog"] or pending:
                transaction.set_rollback(True)
                return Response(
                    {
                        "detail": "Ainda há itens pendentes.",
                        "pending": pending,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            review.advance(day)
        return Response(status=status.HTTP_204_NO_CONTENT)
