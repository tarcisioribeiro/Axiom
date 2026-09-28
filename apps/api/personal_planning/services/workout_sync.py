"""
Tarefa de Exercício vinculada ao treino (`RoutineTask.linked_workout`).

- A tarefa só aparece em dias com treino agendado (algum plano ativo com
  divisão marcada para o dia da semana).
- Ela é concluída apenas pelo registro das sessões: quando toda divisão
  agendada para o dia tem uma sessão registrada, as instâncias vinculadas são
  concluídas; se uma sessão for removida, voltam a pendentes.
- Conclusão manual (kanban/lista/bloco de foco) é bloqueada nas views via
  `manual_change_blocked` — concluir a tarefa não registra sessões.

Instâncias alteradas por aqui recebem `_workout_synced = True`.
"""

MANUAL_CHANGE_BLOCKED_MSG = (
    "Tarefas vinculadas ao treino são concluídas automaticamente ao registrar"
    " as sessões de todas as divisões do dia no módulo de Treino."
)


def scheduled_division_ids(owner, day):
    """IDs das divisões de planos ativos agendadas para o dia da semana."""
    from personal_planning.models import WorkoutDay

    weekday = day.weekday()
    divisions = WorkoutDay.objects.filter(
        owner=owner,
        deleted_at__isnull=True,
        plan__deleted_at__isnull=True,
        plan__is_active=True,
    ).values_list("id", "days_of_week")
    # ponytail: filtro em Python (JSON contains não roda no SQLite dos
    # testes); poucos registros por usuário
    return {pk for pk, days in divisions if weekday in (days or [])}


def all_sessions_logged(owner, day):
    from personal_planning.models import WorkoutSession

    required = scheduled_division_ids(owner, day)
    if not required:
        return False
    done = set(
        WorkoutSession.objects.filter(
            owner=owner,
            date=day,
            deleted_at__isnull=True,
            workout_day_id__in=required,
        ).values_list("workout_day_id", flat=True)
    )
    return required <= done


def manual_change_blocked(instance, new_status):
    """True se a mudança manual entra ou sai de 'completed' numa tarefa
    vinculada ao treino."""
    template = instance.template
    if not (template and template.linked_workout):
        return False
    return (new_status == "completed") != (instance.status == "completed")


def sync_day(owner, day):
    from personal_planning.models import TaskInstance
    from personal_planning.services.instance_generator import (
        InstanceGenerator,
    )

    # Geração lazy: o dia pode ainda não ter sido aberto na Rotina Diária
    InstanceGenerator.generate_for_date(owner, day)
    done = all_sessions_logged(owner, day)
    instances = TaskInstance.objects.filter(
        owner=owner,
        scheduled_date=day,
        deleted_at__isnull=True,
        template__linked_workout=True,
    ).select_related("template")
    for inst in instances:
        if done == (inst.status == "completed"):
            continue
        inst.status = "completed" if done else "pending"
        if not done:
            inst.completed_at = None
            inst.quantity_completed = 0
        inst._workout_synced = True
        inst.save()
