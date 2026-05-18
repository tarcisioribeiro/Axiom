from celery import shared_task


@shared_task(bind=True, max_retries=2, default_retry_delay=600)
def generate_weekly_insights_all_users(self) -> dict:
    """Gera insights proativos via InsightAgent para todos os usuários ativos."""
    from django.contrib.auth.models import User

    user_ids = list(User.objects.filter(is_active=True).values_list("id", flat=True))
    for user_id in user_ids:
        generate_weekly_insight_for_user.delay(user_id)
    return {"dispatched": len(user_ids)}


@shared_task(bind=True, max_retries=2, default_retry_delay=300)
def generate_weekly_insight_for_user(self, user_id: int) -> dict:
    """Gera um insight semanal para um usuário e salva como Notification."""
    try:
        from django.contrib.auth.models import User
        from django.utils import timezone

        from agents.core.base_agent import AgentContext
        from members.models import Member
        from notifications.models import Notification

        user = User.objects.get(pk=user_id)

        # Verifica se já existe um insight desta semana para não duplicar.
        week_start = timezone.now().date()
        week_start = week_start.replace(day=week_start.day - week_start.weekday())
        already_exists = Notification.objects.filter(
            owner__user=user,
            notification_type="agent_insight",
            created_at__date__gte=week_start,
            is_deleted=False,
        ).exists()
        if already_exists:
            return {
                "status": "skipped",
                "reason": "insight already generated this week",
            }

        member = Member.objects.filter(user=user, is_deleted=False).first()
        if not member:
            return {"status": "skipped", "reason": "no member for user"}

        ctx = AgentContext(
            user_id=user_id,
            query="resumo semanal financeiro",
            history=[],
            metadata={},
        )

        from agents.agents.insight_agent import InsightAgent

        agent = InsightAgent()
        response = agent.run(ctx)

        # Trunca o conteúdo para caber no campo de mensagem (max 2000 chars).
        content = response.content[:2000]

        Notification.objects.create(
            owner=member,
            notification_type="agent_insight",
            content_type="agent_insight",
            object_id=0,
            title="Insight semanal do seu assistente financeiro",
            message=content,
            due_date=None,
            created_by=user,
        )
        return {"status": "ok", "user_id": user_id}
    except Exception as exc:
        raise self.retry(exc=exc)
