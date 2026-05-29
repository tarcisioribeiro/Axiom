"""
Serviço de geração de instâncias de tarefas.

Responsável por criar TaskInstance a partir de templates (RoutineTask)
para uma data específica, aplicando regras de recorrência e horários.
"""

from datetime import datetime, time, timedelta
from typing import List, Optional

from django.db import transaction

from personal_planning.models import RoutineTask, TaskInstance


class InstanceGenerator:
    """
    Gera instâncias de tarefas a partir de templates.

    Comportamentos:
    - Geração lazy: instâncias são criadas quando o usuário visualiza a data
    - Instâncias existentes não são sobrescritas
    - Template changes não afetam instâncias já geradas
    - Cada unidade do target_quantity gera uma instância separada
    """

    @classmethod
    def generate_for_date(
        cls, owner, target_date, force_regenerate: bool = False
    ) -> List[TaskInstance]:
        """
        Gera todas as instâncias de tarefas para um owner em uma data
        específica.

        Args:
            owner: Member instance
            target_date: datetime.date
            force_regenerate: Se True, recria instâncias pendentes
                (não altera completadas)

        Returns:
            List of TaskInstance objects
        """
        # Busca templates ativos para este owner
        templates = RoutineTask.objects.filter(
            owner=owner, is_active=True, deleted_at__isnull=True
        )

        instances = []

        with transaction.atomic():
            for template in templates:
                if template.should_appear_on_date(target_date):
                    new_instances = cls._generate_instances_for_template(
                        template, target_date, owner, force_regenerate
                    )
                    instances.extend(new_instances)

        # Ordena por horário
        instances.sort(
            key=lambda x: (
                x.scheduled_time or time(23, 59),
                x.occurrence_index,
            )
        )

        return instances

    @classmethod
    def get_existing_instances(cls, owner, target_date) -> List[TaskInstance]:
        """
        Retorna instâncias existentes para uma data sem gerar novas.

        Útil para visualização de histórico.
        """
        return list(
            TaskInstance.objects.filter(
                owner=owner,
                scheduled_date=target_date,
                deleted_at__isnull=True,
            )
            .select_related("template")
            .order_by("scheduled_time", "occurrence_index")
        )

    @classmethod
    def _generate_instances_for_template(
        cls, template: RoutineTask, target_date, owner, force_regenerate: bool
    ) -> List[TaskInstance]:
        """
        Gera instâncias para um template específico.

        Lógica de quantidade de instâncias:
        1. Se daily_occurrences > 1: usa daily_occurrences
        2. Se target_quantity > 1: usa target_quantity
           (cada unidade = 1 instância)
        3. Caso contrário: 1 instância

        Lógica de horários:
        1. Se scheduled_times está definido, usa os horários da lista
        2. Se interval_hours está definido, calcula horários a partir de
        default_time
        3. Caso contrário, usa default_time para todas as ocorrências
        """
        instances = []

        # Determina número de instâncias a criar
        num_occurrences = cls._calculate_num_occurrences(template)

        # Calcula horários programados
        times = cls._calculate_times(template, num_occurrences)

        for i in range(num_occurrences):
            instance = cls._get_or_create_instance(
                template=template,
                target_date=target_date,
                occurrence_index=i,
                scheduled_time=times[i] if times and i < len(times) else None,
                owner=owner,
                force_regenerate=force_regenerate,
            )
            instances.append(instance)

        return instances

    @classmethod
    def _calculate_num_occurrences(cls, template: RoutineTask) -> int:
        """
        Calcula o número de instâncias a serem geradas.

        Prioridade:
        1. daily_occurrences (se > 1)
        2. target_quantity (cada unidade = 1 instância)
        3. Default: 1
        """
        if template.daily_occurrences and template.daily_occurrences > 1:
            return template.daily_occurrences
        if template.target_quantity and template.target_quantity > 1:
            return template.target_quantity
        return 1

    @classmethod
    def _calculate_times(
        cls, template: RoutineTask, num_occurrences: int
    ) -> Optional[List[time]]:
        """
        Calcula os horários para cada ocorrência.

        Retorna None se nenhum horário for definido.
        """
        # 1. Horários explícitos definidos
        if template.scheduled_times:
            parsed_times = []
            for t in template.scheduled_times[:num_occurrences]:
                try:
                    parsed_times.append(datetime.strptime(t, "%H:%M").time())
                except (ValueError, TypeError):
                    continue
            if parsed_times:
                # Preenche com horários distribuídos se faltarem
                while len(parsed_times) < num_occurrences:
                    parsed_times.append(parsed_times[-1])
                return sorted(parsed_times)

        # 2. Calcula baseado em intervalo
        if template.interval_hours and template.default_time:
            times = []
            base_datetime = datetime.combine(
                datetime.today(), template.default_time
            )
            for i in range(num_occurrences):
                new_time = base_datetime + timedelta(
                    hours=template.interval_hours * i
                )
                # Garante que não passe de 23:59
                if new_time.hour < 24:
                    times.append(new_time.time())
                else:
                    # Se ultrapassar meia-noite, usa 23:59
                    times.append(time(23, 59))
            return times

        # 3. Usa default_time para todas
        if template.default_time:
            return [template.default_time] * num_occurrences

        # Sem horários definidos
        return None

    @classmethod
    def _get_or_create_instance(
        cls,
        template: RoutineTask,
        target_date,
        occurrence_index: int,
        scheduled_time: Optional[time],
        owner,
        force_regenerate: bool,
    ) -> TaskInstance:
        """
        Obtém instância existente ou cria uma nova.

        Se force_regenerate=True e a instância existe mas está pendente,
        atualiza com dados mais recentes do template.
        """
        # Busca instância existente
        existing = TaskInstance.objects.filter(
            template=template,
            scheduled_date=target_date,
            occurrence_index=occurrence_index,
            owner=owner,
            deleted_at__isnull=True,
        ).first()

        if existing:
            needs_update = False

            # Se force_regenerate e ainda pendente, atualiza dados do template
            if force_regenerate and existing.status == "pending":
                existing.task_name = template.name
                existing.task_description = template.description
                existing.category = template.category
                existing.icon = template.icon
                existing.priority = template.priority
                existing.scheduled_time = scheduled_time
                existing.unit = template.unit
                needs_update = True
            # Sempre atualiza scheduled_time se estiver vazio
            # e temos horário do template
            elif (
                existing.scheduled_time is None and scheduled_time is not None
            ):
                existing.scheduled_time = scheduled_time
                needs_update = True

            if needs_update:
                existing.save()
            return existing

        # Cria nova instância
        instance = TaskInstance.objects.create(
            template=template,
            task_name=template.name,
            task_description=template.description,
            category=template.category,
            icon=template.icon,
            priority=template.priority,
            scheduled_date=target_date,
            scheduled_time=scheduled_time,
            occurrence_index=occurrence_index,
            status="pending",
            target_quantity=1,  # Cada instância representa 1 unidade
            quantity_completed=0,
            unit=template.unit,
            owner=owner,
            created_by=(
                owner.user if hasattr(owner, "user") and owner.user else None
            ),
            updated_by=(
                owner.user if hasattr(owner, "user") and owner.user else None
            ),
        )

        return instance

    @classmethod
    def regenerate_pending_instances(
        cls, owner, target_date
    ) -> List[TaskInstance]:
        """
        Regenera instâncias pendentes com dados atualizados do template.

        Útil quando o usuário altera o template e quer atualizar
        as instâncias pendentes do dia atual.
        """
        return cls.generate_for_date(owner, target_date, force_regenerate=True)

    @classmethod
    def create_oneoff_instance(
        cls,
        owner,
        task_name: str,
        scheduled_date,
        category: str = "other",
        scheduled_time: Optional[time] = None,
        description: Optional[str] = None,
        unit: str = "vez",
        icon: Optional[str] = None,
    ) -> TaskInstance:
        """
        Cria uma tarefa avulsa (sem template).

        Útil para tarefas pontuais que não fazem parte de uma rotina.
        """
        return TaskInstance.objects.create(
            template=None,  # Sem template - tarefa avulsa
            task_name=task_name,
            task_description=description,
            category=category,
            icon=icon,
            scheduled_date=scheduled_date,
            scheduled_time=scheduled_time,
            occurrence_index=0,
            status="pending",
            target_quantity=1,
            quantity_completed=0,
            unit=unit,
            owner=owner,
            created_by=(
                owner.user if hasattr(owner, "user") and owner.user else None
            ),
            updated_by=(
                owner.user if hasattr(owner, "user") and owner.user else None
            ),
        )
