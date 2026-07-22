from celery import shared_task


@shared_task(
    bind=True, max_retries=2, default_retry_delay=300, ignore_result=True
)
def detect_goal_risk(self) -> dict:
    """
    Detecta metas em risco (pace atrasado) e gera notificações para os donos.

    Executa diariamente. Para cada meta ativa com end_date definida, calcula
    o progresso esperado vs real. Se o ritmo estiver abaixo de 70% do esperado,
    gera uma notificação de alerta.
    """
    try:
        from datetime import date

        from personal_planning.models import Goal

        today = date.today()
        total_checked = 0
        total_at_risk = 0

        active_goals = Goal.objects.filter(
            status="active",
            end_date__isnull=False,
            deleted_at__isnull=True,
        ).select_related("owner__user")

        for goal in active_goals:
            total_checked += 1
            start = goal.start_date
            end = goal.end_date

            if not end or end <= today:
                continue

            total_days = (end - start).days
            days_elapsed = (today - start).days

            if total_days <= 0 or days_elapsed <= 0:
                continue

            expected_pct = min((days_elapsed / total_days) * 100, 100)
            actual_pct = goal.progress_percentage

            if actual_pct < expected_pct * 0.70:
                total_at_risk += 1
                _notify_goal_risk(goal, actual_pct, expected_pct)

        return {
            "status": "ok",
            "checked": total_checked,
            "at_risk": total_at_risk,
        }
    except Exception as exc:
        raise self.retry(exc=exc)


def _notify_goal_risk(goal, actual_pct: float, expected_pct: float) -> None:
    """Gera notificação de meta em risco se ainda não foi notificado hoje."""
    try:
        from django.utils import timezone

        from notifications.models import Notification

        today = timezone.now().date()
        already_notified = Notification.objects.filter(
            owner=goal.owner,
            notification_type="financial_goal_approaching",
            content_type="goal",
            object_id=goal.id,
            created_at__date=today,
        ).exists()

        if already_notified:
            return

        Notification.objects.create(
            owner=goal.owner,
            title=f"Meta em risco: {goal.title}",
            message=(
                f'Sua meta "{goal.title}" está com '
                f"{actual_pct:.0f}% de progresso, mas deveria estar "
                f"com {expected_pct:.0f}% para estar no prazo. "
                "Considere acelerar o ritmo ou revisar o objetivo."
            ),
            notification_type="financial_goal_approaching",
            content_type="goal",
            object_id=goal.id,
        )
    except Exception:
        pass


@shared_task(
    bind=True, max_retries=2, default_retry_delay=300, ignore_result=True
)
def generate_weekly_planning_synthesis(self) -> dict:
    """
    Gera síntese semanal de planejamento pessoal via PlanningAgent (LLM).

    Executa toda segunda-feira às 08h. Itera sobre todos os usuários com
    perfis de membro ativos e solicita ao PlanningAgent um resumo do
    desempenho da semana anterior.
    """
    try:
        from members.models import Member

        members = Member.objects.filter(
            user__is_active=True,
            deleted_at__isnull=True,
        ).select_related("user")

        total = 0
        for member in members:
            try:
                _generate_synthesis_for_member(member)
                total += 1
            except Exception:
                pass

        return {"status": "ok", "processed": total}
    except Exception as exc:
        raise self.retry(exc=exc)


def _generate_synthesis_for_member(member) -> None:
    """Chama PlanningAgent para gerar síntese semanal e salvar notificação."""
    try:
        from agents.core.base_agent import AgentContext
        from agents.core.router import AgentRouter
        from notifications.models import Notification

        agent = AgentRouter.select_by_name("planning")
        if agent is None:
            return

        prompt = (
            "Gere um resumo breve do meu desempenho na semana passada "
            "em relação às minhas rotinas, metas e hábitos. "
            "Destaque o que foi bem e o que pode melhorar. "
            "Máximo 3 parágrafos."
        )
        ctx = AgentContext(user_id=member.user.id, query=prompt)
        response = agent.run(ctx)

        if response and response.content:
            Notification.objects.create(
                owner=member,
                title="Síntese Semanal de Planejamento",
                message=response.content[:2000],
                notification_type="agent_insight",
                content_type="weekly_synthesis",
                object_id=member.id,
            )
    except Exception:
        pass
