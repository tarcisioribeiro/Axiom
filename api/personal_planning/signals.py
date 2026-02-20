"""
Signals para atualizacao automatica de progresso de objetivos.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone


@receiver(post_save, sender="personal_planning.TaskInstance")
def update_goal_progress_on_instance_complete(sender, instance, created, **kwargs):
    """
    Atualiza progresso de objetivo quando uma instância de tarefa é completada.
    """
    from personal_planning.models import Goal

    if instance.status != "completed":
        return

    # Verificar se a instância tem um template
    if not instance.template:
        return

    # Buscar objetivos ativos relacionados a esta tarefa (template)
    goals = Goal.objects.filter(
        related_task=instance.template, status="active", deleted_at__isnull=True
    )

    for goal in goals:
        if goal.goal_type in ["consecutive_days", "total_days"]:
            # Incrementar progresso
            goal.current_value += 1

            # Verificar se objetivo foi cumprido
            if goal.current_value >= goal.target_value:
                goal.status = "completed"
                goal.end_date = timezone.now().date()

            goal.save(update_fields=["current_value", "status", "end_date"])
