from celery import shared_task


@shared_task(bind=True, max_retries=2, default_retry_delay=600)
def generate_weekly_insights_all_users(self) -> dict:
    """
    Gera insights proativos via InsightAgent para todos os usuários ativos.
    """
    from django.contrib.auth.models import User

    user_ids = list(
        User.objects.filter(is_active=True).values_list("id", flat=True)
    )
    for user_id in user_ids:
        generate_weekly_insight_for_user.delay(user_id)
    return {"dispatched": len(user_ids)}


@shared_task(bind=True, max_retries=2, default_retry_delay=300)
def generate_weekly_insight_for_user(self, user_id: int) -> dict:
    """Gera um insight semanal para um usuário e salva como Notification."""
    try:
        import logging
        from datetime import timedelta

        from django.contrib.auth.models import User
        from django.utils import timezone

        from agents.core.base_agent import AgentContext
        from members.models import Member
        from notifications.models import Notification
        from notifications.services import dispatch_notification

        logger = logging.getLogger("axiom")
        user = User.objects.get(pk=user_id)

        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())

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

        try:
            from agents.agents.insight_agent import InsightAgent

            agent = InsightAgent()
            response = agent.run(ctx)
            content = response.content[:2000]
        except Exception:
            logger.exception(
                "LLM unavailable for weekly insight (user_id=%s)"
                " — using fallback",
                user_id,
            )
            content = _build_fallback_insight(user)

        notification = Notification.objects.create(
            owner=member,
            notification_type="agent_insight",
            content_type="agent_insight",
            object_id=0,
            title="Insight semanal do seu assistente financeiro",
            message=content,
            due_date=None,
            created_by=user,
        )
        dispatch_notification(notification)
        return {"status": "ok", "user_id": user_id}
    except Exception as exc:
        raise self.retry(exc=exc)


def _build_fallback_insight(user: object) -> str:
    """Texto de fallback quando o LLM não está disponível."""
    try:
        from django.utils import timezone

        from agents.tools.financial_tools import (
            get_current_month_totals,
            get_total_balances,
        )

        now = timezone.now()
        balances = get_total_balances(user)  # type: ignore[arg-type]
        total_balance = sum(float(b["current_balance"]) for b in balances)
        month_totals = get_current_month_totals(user)  # type: ignore[arg-type]
        period = now.strftime("%B/%Y")
        return (
            f"Resumo financeiro — {period}:\n"
            f"Receitas: R$ {month_totals['revenues']:.2f} | "
            f"Despesas: R$ {month_totals['expenses']:.2f} | "
            f"Saldo total: R$ {total_balance:.2f}"
        )
    except Exception:
        return (
            "Resumo semanal indisponível no momento."
            " Acesse o app para ver seus dados financeiros."
        )


@shared_task(bind=True, max_retries=2, default_retry_delay=600)
def send_weekly_intellect_recommendations(self) -> dict:
    """
    Domingo às 09:00 — envia recomendações de leitura/aprendizado semanais
    para todos os usuários ativos via Notification.
    Usa o planning agent para sugerir conteúdo baseado no histórico.
    """
    try:
        from django.contrib.auth.models import User

        user_ids = list(
            User.objects.filter(is_active=True).values_list("id", flat=True)
        )
        for user_id in user_ids:
            _send_intellect_recommendation_for_user.delay(user_id)
        return {"dispatched": len(user_ids)}
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=1, default_retry_delay=60)
def _send_intellect_recommendation_for_user(self, user_id: int) -> dict:
    """Gera e envia recomendação de leitura semanal para um usuário."""
    try:
        from django.contrib.auth.models import User
        from django.utils import timezone

        from members.models import Member
        from notifications.models import Notification

        user = User.objects.get(pk=user_id)
        member = Member.objects.filter(user=user, is_deleted=False).first()
        if not member:
            return {"status": "skipped", "reason": "no member"}

        from datetime import timedelta

        today = timezone.now().date()
        already_exists = Notification.objects.filter(
            owner=member,
            notification_type="agent_insight",
            title__icontains="leitura",
            created_at__date__gte=today - timedelta(days=7),
            is_deleted=False,
        ).exists()
        if already_exists:
            return {"status": "skipped", "reason": "already sent this week"}

        # Contexto de leitura do usuário
        try:
            from library.models import Book, Skill

            to_read = list(
                Book.objects.filter(
                    owner=member, read_status="to_read", is_deleted=False
                )
                .order_by("reading_priority")
                .values_list("title", flat=True)[:3]
            )
            skills = list(
                Skill.objects.filter(owner=member, is_deleted=False)
                .order_by("-updated_at")
                .values_list("name", flat=True)[:3]
            )
        except Exception:
            to_read, skills = [], []

        recommendation = _build_intellect_recommendation(to_read, skills)

        Notification.objects.create(
            owner=member,
            notification_type="agent_insight",
            content_type="agent_insight",
            object_id=0,
            title="Recomendação de Leitura da Semana 📚",
            message=recommendation,
            due_date=None,
            created_by=user,
        )
        return {"status": "ok", "user_id": user_id}
    except Exception as exc:
        raise self.retry(exc=exc)


def _build_intellect_recommendation(to_read: list, skills: list) -> str:
    """Tenta LLM; fallback para mensagem estática."""
    try:
        from agents.core.llm_client import LLMClient

        to_read_text = ", ".join(to_read) if to_read else "nenhum na fila"
        skills_text = ", ".join(skills) if skills else "nenhuma registrada"
        prompt = (
            "Você é um mentor de aprendizado. Crie uma recomendação semanal"
            " motivacional (máx. 3 frases) para alguém com os seguintes"
            f" dados:\n- Próximos livros na fila: {to_read_text}\n"
            f"- Principais habilidades: {skills_text}\n"
            "Escreva em português brasileiro, seja específico e animador."
        )
        return LLMClient.chat([{"role": "user", "content": prompt}])
    except Exception:
        if to_read:
            return (
                f"Sua semana de aprendizado começa com '{to_read[0]}'. "
                "Reserve 20 minutos diários e mantenha o ritmo! 📖"
            )
        return (
            "Que tal escolher um novo livro para ler esta semana? "
            "Adicione títulos à sua fila e comece agora! 📚"
        )


@shared_task(bind=True, max_retries=1, default_retry_delay=5)
def persist_agent_conversation(
    self,
    user_id: int,
    session_id: str,
    query: str,
    answer: str,
    agent_name: str,
    query_id: str,
) -> dict:
    """
    Persiste uma conversa de agente de forma assíncrona via Celery.

    Usado como alternativa ao daemon thread quando Celery está disponível.
    A view usa daemon thread diretamente — esta task é mantida para uso
    explícito em fluxos que já operam dentro de um worker Celery.
    """
    try:
        from django.contrib.auth.models import User

        from agents.core.memory import ConversationMemory
        from agents.models import AgentConversation

        user = User.objects.get(pk=user_id)
        ConversationMemory.append(user_id, session_id, query, answer)
        AgentConversation.objects.bulk_create(
            [
                AgentConversation(
                    user=user,
                    session_id=session_id,
                    role="user",
                    content=query,
                    query_id=query_id,
                    created_by=user,
                    updated_by=user,
                ),
                AgentConversation(
                    user=user,
                    session_id=session_id,
                    role="assistant",
                    content=answer,
                    agent_name=agent_name,
                    query_id=query_id,
                    created_by=user,
                    updated_by=user,
                ),
            ]
        )
        return {"status": "ok"}
    except Exception as exc:
        raise self.retry(exc=exc)
