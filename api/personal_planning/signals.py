"""
Signals para atualizacao automatica de progresso de objetivos e notificações.
"""

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone


@receiver(post_save, sender="personal_planning.TaskInstance")
def update_goal_progress_on_instance_complete(sender, instance, created, **kwargs):
    """
    Verifica e atualiza o status de objetivos quando uma instancia de tarefa muda.

    Usa calculated_current_value (fonte de verdade) em vez de incrementos manuais,
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
        # avoid_habit: nunca marcar como completo quando uma instância é completada
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
            title=f"🎯 Objetivo concluído: {goal.title}",
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


@receiver(post_save, sender="personal_planning.RoutineTask")
def embed_routine_task(sender, instance, **kwargs):
    from agents.services.embedding_service import generate_embedding_for_instance

    source_title = instance.name

    def _embed():
        generate_embedding_for_instance(
            instance,
            domain="planning",
            source_type="routine",
            content_fn=lambda i: (
                f"Rotina '{i.name}': {i.description or ''}, frequência {i.periodicity}"
            ),
            source_title=source_title,
        )

    transaction.on_commit(_embed)


@receiver(post_save, sender="personal_planning.Goal")
def embed_goal(sender, instance, **kwargs):
    from agents.services.embedding_service import generate_embedding_for_instance

    source_title = instance.title

    def _embed():
        target = instance.target_value or 1
        progress = int(instance.current_value / target * 100)
        generate_embedding_for_instance(
            instance,
            domain="planning",
            source_type="goal",
            content_fn=lambda i: (
                f"Meta '{i.title}': {i.description or ''}," f" progresso {progress}%"
            ),
            source_title=source_title,
        )

    transaction.on_commit(_embed)
