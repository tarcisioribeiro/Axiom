"""
Signals para atualizacao automatica de progresso de objetivos e notificações.
"""

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone


@receiver(post_save, sender="personal_planning.TaskInstance")
def update_goal_progress_on_instance_complete(
    sender, instance, created, **kwargs
):
    """
    Verifica e atualiza o status de objetivos quando uma instancia de tarefa
    muda.

    Usa calculated_current_value (fonte de verdade) em vez de
    incrementos manuais,
    evitando divergencias entre o campo armazenado e o valor real.
    """
    from personal_planning.models import Goal

    if not instance.template:
        return

    goals = Goal.objects.filter(
        related_task=instance.template,
        status="active",
        deleted_at__isnull=True,
    ).select_related("owner", "related_task")

    for goal in goals:
        # avoid_habit: nunca marcar como completo quando uma instância é
        # completada
        # (completar a tarefa quebra o objetivo)
        if goal.goal_type == "avoid_habit" and instance.status == "completed":
            continue

        current = goal.calculated_current_value
        if current >= goal.target_value:
            goal.status = "completed"
            goal.end_date = timezone.now().date()
            goal.save(update_fields=["status", "end_date", "updated_at"])
            _notify_goal_completed(goal)


def _notify_goal_completed(goal):
    """Cria notificação in-app quando um objetivo é concluído."""
    try:
        from notifications.models import Notification

        Notification.objects.create(
            owner=goal.owner,
            notification_type="task_today",
            title=f"Objetivo concluído: {goal.title}",
            message=(
                f"Parabéns! Você atingiu sua meta de {goal.target_value} "
                f'para o objetivo "{goal.title}".'
            ),
            content_type="Goal",
            object_id=goal.id,
            created_by=goal.owner.user if goal.owner.user_id else None,
            updated_by=goal.owner.user if goal.owner.user_id else None,
        )
    except Exception:
        pass


@receiver(post_save, sender="personal_planning.TaskInstance")
def award_xp_on_task_completion(sender, instance, created, **kwargs):
    """Concede XP ao membro quando uma tarefa é concluída."""
    if instance.status != "completed":
        return

    # Só processa a primeira vez que o status se torna "completed"
    prev_status = getattr(instance, "_prev_status", None)
    if not created and prev_status == "completed":
        return

    try:
        from personal_planning.models import GamificationProfile

        profile, _ = GamificationProfile.objects.get_or_create(
            member=instance.owner,
            defaults={"created_by": instance.created_by},
        )
        profile.tasks_completed_total += 1
        profile.save(update_fields=["tasks_completed_total", "updated_at"])

        xp = 10 + (5 if instance.priority in ("high", "critical") else 0)
        profile.add_xp(xp, "task_completed", f"Tarefa: {instance.task_name}")
        profile.update_streak(instance.scheduled_date)

        # Badge de marcos de tarefas
        for milestone, slug, name, reward in [
            (10, "tasks_10", "Iniciante", 20),
            (50, "tasks_50", "Consistente", 100),
            (100, "tasks_100", "Dedicado", 250),
            (500, "tasks_500", "Mestre das Rotinas", 1000),
        ]:
            if profile.tasks_completed_total == milestone:
                from personal_planning.models import Badge, UserBadge

                badge, _ = Badge.objects.get_or_create(
                    slug=slug,
                    defaults={
                        "name": name,
                        "description": f"Concluiu {milestone} tarefas",
                        "category": "completion",
                        "icon": "CheckCircle",
                        "xp_reward": reward,
                        "created_by": instance.created_by,
                    },
                )
                _, earned = UserBadge.objects.get_or_create(
                    profile=profile,
                    badge=badge,
                    defaults={"created_by": instance.created_by},
                )
                if earned:
                    profile.add_xp(
                        reward, "badge_earned", f"Badge: {badge.name}"
                    )
    except Exception:
        pass


@receiver(post_save, sender="personal_planning.Goal")
def award_xp_on_goal_completed(sender, instance, created, **kwargs):
    """Concede XP quando um objetivo é concluído."""
    if instance.status != "completed" or created:
        return

    try:
        from personal_planning.models import (
            Badge,
            GamificationProfile,
            UserBadge,
        )

        profile, _ = GamificationProfile.objects.get_or_create(
            member=instance.owner,
            defaults={"created_by": instance.created_by},
        )
        xp = 100
        profile.add_xp(xp, "goal_completed", f"Objetivo: {instance.title}")

        slug = f"goal_{instance.goal_type}_first"
        badge, _ = Badge.objects.get_or_create(
            slug=slug,
            defaults={
                "name": (
                    "Primeiro Objetivo"
                    f" ({instance.get_goal_type_display()})"
                ),
                "description": "Concluiu o primeiro objetivo deste tipo",
                "category": "goal",
                "icon": "Target",
                "xp_reward": 0,
                "created_by": instance.created_by,
            },
        )
        UserBadge.objects.get_or_create(
            profile=profile,
            badge=badge,
            defaults={"created_by": instance.created_by},
        )
    except Exception:
        pass


@receiver(post_save, sender="personal_planning.RoutineTask")
def embed_routine_task(sender, instance, **kwargs):
    from agents.services.embedding_service import (
        generate_embedding_for_instance,
    )

    source_title = instance.name

    def _embed():
        generate_embedding_for_instance(
            instance,
            domain="planning",
            source_type="routine",
            content_fn=lambda i: (
                f"Rotina '{i.name}': {i.description or ''},"
                f" frequência {i.periodicity}"
            ),
            source_title=source_title,
        )

    transaction.on_commit(_embed)


@receiver(post_save, sender="personal_planning.Goal")
def embed_goal(sender, instance, **kwargs):
    from agents.services.embedding_service import (
        generate_embedding_for_instance,
    )

    source_title = instance.title

    def _embed():
        target = instance.target_value or 1
        progress = int(instance.current_value / target * 100)
        generate_embedding_for_instance(
            instance,
            domain="planning",
            source_type="goal",
            content_fn=lambda i: (
                f"Meta '{i.title}': {i.description or ''},"
                f" progresso {progress}%"
            ),
            source_title=source_title,
        )

    transaction.on_commit(_embed)
