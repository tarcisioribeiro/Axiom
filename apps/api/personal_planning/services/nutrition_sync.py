"""
Sincronização bidirecional entre tarefas de Nutrição e o diário alimentar.

- Tarefa com `linked_meal_type` concluída → cria MealLog (se ainda não há um
  para a refeição no dia) com a opção padrão da refeição ou, sem ela, a de
  maior caloria. MealLog registrado no Diário → conclui a tarefa.
- Tarefa com `linked_hydration_goal` concluída → cria WaterLog de
  meta ÷ ocorrências do dia. Água registrada no Diário → conclui tantas
  ocorrências quanto o total do dia cobrir.
- Desfazer de um lado desfaz do outro (reabrir tarefa apaga o registro que ela
  criou; apagar o registro reabre a tarefa).

Instâncias/registros alterados por aqui recebem `_nutrition_synced = True`
para que os signals não disparem a sincronização de volta (evita cascata).
"""

from django.utils import timezone

OPEN_STATUSES = ("pending", "in_progress")


def _instances(owner, day, **template_filter):
    from personal_planning.models import TaskInstance
    from personal_planning.services.instance_generator import (
        InstanceGenerator,
    )

    # Geração lazy: o dia pode ainda não ter sido aberto na Rotina Diária
    InstanceGenerator.generate_for_date(owner, day)
    return (
        TaskInstance.objects.filter(
            owner=owner,
            scheduled_date=day,
            deleted_at__isnull=True,
            **template_filter,
        )
        .select_related("template")
        .order_by("template_id", "occurrence_index")
    )


def _set_status(instance, status):
    instance.status = status
    if status != "completed":
        instance.completed_at = None
        instance.quantity_completed = 0
    instance._nutrition_synced = True
    instance.save()


def _soft_delete(qs):
    # update() não dispara post_save → não reabre a tarefa de novo
    qs.filter(is_deleted=False).update(
        is_deleted=True, deleted_at=timezone.now()
    )


def _now_time(day):
    now = timezone.localtime()
    return (
        now.time().replace(second=0, microsecond=0)
        if day == now.date()
        else None
    )


def meal_option_for_task(meal_type):
    """Opção padrão da refeição; sem ela, a de maior caloria (None se 0)."""
    from personal_planning.models import MenuOption

    if meal_type.default_menu_option_id:
        return meal_type.default_menu_option
    options = MenuOption.objects.filter(
        meal_type=meal_type, deleted_at__isnull=True
    ).prefetch_related("ingredients__food")
    best = max(options, key=lambda o: o.calories, default=None)
    return best if best and best.calories > 0 else None


def water_per_occurrence_ml(instance):
    """Meta diária ÷ nº de ocorrências da tarefa no dia."""
    from personal_planning.models import TaskInstance

    goal = instance.template.linked_hydration_goal
    count = TaskInstance.objects.filter(
        template=instance.template,
        scheduled_date=instance.scheduled_date,
        deleted_at__isnull=True,
    ).count()
    return round(goal.daily_target_ml / max(count, 1))


# ---------------------------------------------------------------------------
# Tarefa → registro
# ---------------------------------------------------------------------------


def on_task_instance_saved(instance):
    if getattr(instance, "_nutrition_synced", False) or not instance.template:
        return
    from personal_planning.models import MealLog, WaterLog

    template = instance.template
    prev = getattr(instance, "_prev_status", None)
    became_done = instance.status == "completed" and prev != "completed"
    undone = prev == "completed" and instance.status != "completed"

    if undone:
        _soft_delete(MealLog.objects.filter(task_instance=instance))
        _soft_delete(WaterLog.objects.filter(task_instance=instance))
        return
    if not became_done:
        return

    meal_type = template.linked_meal_type
    if meal_type and not meal_type.is_deleted:
        exists = MealLog.objects.filter(
            owner=instance.owner,
            meal_type=meal_type,
            date=instance.scheduled_date,
            is_deleted=False,
        ).exists()
        if not exists:
            MealLog.objects.create(
                meal_type=meal_type,
                menu_option=meal_option_for_task(meal_type),
                date=instance.scheduled_date,
                time=_now_time(instance.scheduled_date),
                notes="Registrado pela tarefa",
                task_instance=instance,
                owner=instance.owner,
                created_by=instance.updated_by,
            )

    goal = template.linked_hydration_goal
    if goal and not goal.is_deleted:
        WaterLog.objects.create(
            date=instance.scheduled_date,
            time=_now_time(instance.scheduled_date),
            amount_ml=water_per_occurrence_ml(instance),
            task_instance=instance,
            owner=instance.owner,
            created_by=instance.updated_by,
        )


# ---------------------------------------------------------------------------
# Registro → tarefa
# ---------------------------------------------------------------------------


def on_meal_log_saved(log, created):
    from personal_planning.models import MealLog

    if log.is_deleted:
        still_logged = MealLog.objects.filter(
            owner=log.owner,
            meal_type=log.meal_type,
            date=log.date,
            is_deleted=False,
        ).exists()
        if not still_logged:
            for inst in _instances(
                log.owner, log.date, template__linked_meal_type=log.meal_type
            ).filter(status="completed"):
                _set_status(inst, "pending")
        return

    if not created or log.task_instance_id:
        return
    done_templates = set()
    for inst in _instances(
        log.owner, log.date, template__linked_meal_type=log.meal_type
    ):
        if inst.template_id in done_templates:
            continue
        if inst.status in OPEN_STATUSES:
            _set_status(inst, "completed")
            done_templates.add(inst.template_id)
        elif inst.status == "completed":
            done_templates.add(inst.template_id)


def on_water_log_saved(log, created):
    from django.db.models import Sum

    from personal_planning.models import WaterLog

    if log.is_deleted:
        inst = log.task_instance
        if inst and inst.status == "completed":
            _set_status(inst, "pending")
        return

    if not created or log.task_instance_id:
        return

    total = (
        WaterLog.objects.filter(
            owner=log.owner, date=log.date, is_deleted=False
        ).aggregate(s=Sum("amount_ml"))["s"]
        or 0
    )
    by_template = {}
    for inst in _instances(
        log.owner, log.date, template__linked_hydration_goal__isnull=False
    ):
        by_template.setdefault(inst.template_id, []).append(inst)

    for insts in by_template.values():
        per = water_per_occurrence_ml(insts[0])
        should_be_done = min(len(insts), total // max(per, 1))
        done = sum(1 for i in insts if i.status == "completed")
        for inst in insts:
            if done >= should_be_done:
                break
            if inst.status in OPEN_STATUSES:
                _set_status(inst, "completed")
                done += 1
