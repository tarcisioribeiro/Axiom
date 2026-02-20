from datetime import date, timedelta

from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from members.models import Member
from personal_planning.models import DailyReflection, Goal, RoutineTask, TaskInstance
from personal_planning.serializers import (
    DailyReflectionCreateUpdateSerializer,
    DailyReflectionSerializer,
    GoalCreateUpdateSerializer,
    GoalSerializer,
    RoutineTaskCreateUpdateSerializer,
    RoutineTaskSerializer,
    TaskInstanceCreateSerializer,
    TaskInstanceSerializer,
    TaskInstanceStatusUpdateSerializer,
    TaskInstanceUpdateSerializer,
)


def log_activity(request, action, model_name, object_id, description):
    """Helper para registrar atividades."""
    try:
        from security.activity_logs.models import ActivityLog

        ActivityLog.log_action(
            user=request.user,
            action=action,
            description=description,
            model_name=model_name,
            object_id=object_id,
            ip_address=get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )
    except Exception:
        pass


def get_client_ip(request):
    """Extrai o IP do cliente."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0]
    else:
        ip = request.META.get("REMOTE_ADDR")
    return ip


# ============================================================================
# ROUTINE TASK VIEWS
# ============================================================================


class RoutineTaskListCreateView(BaseListCreateView):
    """Lista todas as tarefas rotineiras ou cria uma nova."""

    queryset = RoutineTask.objects.all()

    def get_queryset(self):
        return (
            RoutineTask.objects.filter(
                owner__user=self.request.user, deleted_at__isnull=True
            )
            .select_related("owner")
            .prefetch_related("instances", "goals")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return RoutineTaskCreateUpdateSerializer
        return RoutineTaskSerializer

    def perform_create(self, serializer):
        task = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request,
            "create",
            "RoutineTask",
            task.id,
            f"Criou tarefa rotineira: {task.name}",
        )


class RoutineTaskDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma tarefa rotineira."""

    queryset = RoutineTask.objects.all()

    def get_queryset(self):
        return (
            RoutineTask.objects.filter(
                owner__user=self.request.user, deleted_at__isnull=True
            )
            .select_related("owner")
            .prefetch_related("instances", "goals")
        )

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return RoutineTaskCreateUpdateSerializer
        return RoutineTaskSerializer

    def perform_update(self, serializer):
        task = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            "update",
            "RoutineTask",
            task.id,
            f"Atualizou tarefa rotineira: {task.name}",
        )

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save()
        log_activity(
            self.request,
            "delete",
            "RoutineTask",
            instance.id,
            f"Deletou tarefa rotineira: {instance.name}",
        )


# ============================================================================
# GOAL VIEWS
# ============================================================================


class GoalListCreateView(BaseListCreateView):
    """Lista todos os objetivos ou cria um novo."""

    queryset = Goal.objects.all()

    def get_queryset(self):
        return Goal.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "related_task")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return GoalCreateUpdateSerializer
        return GoalSerializer

    def perform_create(self, serializer):
        goal = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request, "create", "Goal", goal.id, f"Criou objetivo: {goal.title}"
        )


class GoalDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um objetivo."""

    queryset = Goal.objects.all()

    def get_queryset(self):
        return Goal.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "related_task")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return GoalCreateUpdateSerializer
        return GoalSerializer

    def perform_update(self, serializer):
        goal = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request, "update", "Goal", goal.id, f"Atualizou objetivo: {goal.title}"
        )

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save()
        log_activity(
            self.request,
            "delete",
            "Goal",
            instance.id,
            f"Deletou objetivo: {instance.title}",
        )


class GoalRecalculateView(APIView):
    """
    Recalcula o progresso do objetivo baseado nos dias passados.
    Para objetivos do tipo 'consecutive_days', atualiza current_value para days_active.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            goal = Goal.objects.get(
                pk=pk, owner__user=request.user, deleted_at__isnull=True
            )
        except Goal.DoesNotExist:
            return Response(
                {"detail": "Objetivo não encontrado."}, status=status.HTTP_404_NOT_FOUND
            )

        # Atualiza current_value para dias ativos
        # (apenas para goal_type consecutive_days)
        if goal.goal_type == "consecutive_days":
            goal.current_value = goal.days_active
            # Verifica se atingiu a meta
            if goal.current_value >= goal.target_value:
                goal.status = "completed"
                goal.end_date = timezone.now().date()
            goal.save(
                update_fields=["current_value", "status", "end_date", "updated_at"]
            )

            log_activity(
                request,
                "update",
                "Goal",
                goal.id,
                f"Recalculou progresso do objetivo: {goal.title}",
            )

            serializer = GoalSerializer(goal)
            return Response(serializer.data)

        return Response(
            {
                "detail": (
                    "Recálculo automático só está disponível"
                    " para objetivos de dias consecutivos."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class GoalResetView(APIView):
    """
    Reseta o progresso do objetivo.
    Define current_value = 0 e start_date = hoje, mantendo o status como ativo.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            goal = Goal.objects.get(
                pk=pk, owner__user=request.user, deleted_at__isnull=True
            )
        except Goal.DoesNotExist:
            return Response(
                {"detail": "Objetivo não encontrado."}, status=status.HTTP_404_NOT_FOUND
            )

        # Reseta o progresso
        goal.current_value = 0
        goal.start_date = timezone.now().date()
        goal.end_date = None
        goal.status = "active"
        goal.save(
            update_fields=[
                "current_value",
                "start_date",
                "end_date",
                "status",
                "updated_at",
            ]
        )

        log_activity(
            request,
            "update",
            "Goal",
            goal.id,
            f"Resetou progresso do objetivo: {goal.title}",
        )

        serializer = GoalSerializer(goal)
        return Response(serializer.data)


# ============================================================================
# DAILY REFLECTION VIEWS
# ============================================================================


class DailyReflectionListCreateView(BaseListCreateView):
    """Lista todas as reflexoes diarias ou cria uma nova."""

    queryset = DailyReflection.objects.all()

    def get_queryset(self):
        return DailyReflection.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return DailyReflectionCreateUpdateSerializer
        return DailyReflectionSerializer

    def perform_create(self, serializer):
        reflection = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request,
            "create",
            "DailyReflection",
            reflection.id,
            f"Criou reflexao de {reflection.date}",
        )


class DailyReflectionDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma reflexao diaria."""

    queryset = DailyReflection.objects.all()

    def get_queryset(self):
        return DailyReflection.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return DailyReflectionCreateUpdateSerializer
        return DailyReflectionSerializer

    def perform_update(self, serializer):
        reflection = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            "update",
            "DailyReflection",
            reflection.id,
            f"Atualizou reflexao de {reflection.date}",
        )

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save()
        log_activity(
            self.request,
            "delete",
            "DailyReflection",
            instance.id,
            f"Deletou reflexao de {instance.date}",
        )


# ============================================================================
# DASHBOARD STATS VIEW
# ============================================================================


class PersonalPlanningDashboardStatsView(APIView):
    """
    GET /api/v1/personal-planning/dashboard/stats/

    Retorna estatisticas agregadas do modulo de Planejamento Pessoal.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()

        # Querysets filtrados
        tasks_qs = RoutineTask.objects.filter(owner__user=user, deleted_at__isnull=True)
        instances_qs = TaskInstance.objects.filter(
            owner__user=user, deleted_at__isnull=True
        )
        goals_qs = Goal.objects.filter(owner__user=user, deleted_at__isnull=True)

        # Contadores gerais
        total_tasks = tasks_qs.count()
        active_tasks = tasks_qs.filter(is_active=True).count()
        total_goals = goals_qs.count()
        active_goals = goals_qs.filter(status="active").count()
        completed_goals = goals_qs.filter(status="completed").count()

        # Taxa de cumprimento dos ultimos 7 dias
        seven_days_ago = today - timedelta(days=7)
        recent_instances = instances_qs.filter(scheduled_date__gte=seven_days_ago)
        total_recent = recent_instances.count()
        completed_recent = recent_instances.filter(status="completed").count()
        completion_rate_7d = (
            round((completed_recent / total_recent) * 100, 1)
            if total_recent > 0
            else 0.0
        )

        # Taxa de cumprimento dos ultimos 30 dias
        thirty_days_ago = today - timedelta(days=30)
        month_instances = instances_qs.filter(scheduled_date__gte=thirty_days_ago)
        total_month = month_instances.count()
        completed_month = month_instances.filter(status="completed").count()
        completion_rate_30d = (
            round((completed_month / total_month) * 100, 1) if total_month > 0 else 0.0
        )

        # Tarefas por categoria (Top 5)
        tasks_by_category = list(
            tasks_qs.filter(is_active=True)
            .values("category")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )

        # Adicionar display name
        from personal_planning.models import TASK_CATEGORY_CHOICES

        category_dict = dict(TASK_CATEGORY_CHOICES)
        for item in tasks_by_category:
            item["category_display"] = category_dict.get(
                item["category"], item["category"]
            )

        # Progresso semanal (ultimos 7 dias)
        weekly_progress = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_instances = instances_qs.filter(scheduled_date=day)
            total_day = day_instances.count()
            completed_day = day_instances.filter(status="completed").count()

            weekly_progress.append(
                {
                    "date": day.isoformat(),
                    "total": total_day,
                    "completed": completed_day,
                    "rate": (
                        round((completed_day / total_day) * 100, 1)
                        if total_day > 0
                        else 0
                    ),
                }
            )

        # Objetivos ativos com progresso
        active_goals_data = []
        for goal in goals_qs.filter(status="active")[:5]:
            active_goals_data.append(
                {
                    "title": goal.title,
                    "progress_percentage": round(goal.progress_percentage, 1),
                    "current_value": goal.current_value,
                    "target_value": goal.target_value,
                    "days_active": goal.days_active,
                }
            )

        # Streak atual (dias consecutivos cumprindo todas as tarefas)
        current_streak = self._calculate_current_streak(user, today)

        # Melhor streak
        best_streak = self._calculate_best_streak(user)

        # Tarefas de hoje
        instances_today = instances_qs.filter(scheduled_date=today)
        total_tasks_today = instances_today.count()
        completed_tasks_today = instances_today.filter(status="completed").count()

        # Tarefas rotineiras ativas (usar o serializer)
        from personal_planning.serializers import RoutineTaskSerializer

        active_routine_tasks_qs = tasks_qs.filter(is_active=True).prefetch_related(
            "instances"
        )
        active_routine_tasks_data = RoutineTaskSerializer(
            active_routine_tasks_qs, many=True
        ).data

        # Reflexões recentes (últimas 5) - usar o serializer
        from personal_planning.serializers import DailyReflectionSerializer

        recent_reflections_qs = (
            DailyReflection.objects.filter(owner__user=user, deleted_at__isnull=True)
            .select_related("owner")
            .order_by("-date")[:5]
        )
        recent_reflections_data = DailyReflectionSerializer(
            recent_reflections_qs, many=True
        ).data

        stats = {
            "total_tasks": total_tasks,
            "active_tasks": active_tasks,
            "total_goals": total_goals,
            "active_goals": active_goals,
            "completed_goals": completed_goals,
            "completion_rate_7d": completion_rate_7d,
            "completion_rate_30d": completion_rate_30d,
            "current_streak": current_streak,
            "best_streak": best_streak,
            "tasks_by_category": tasks_by_category,
            "weekly_progress": weekly_progress,
            "active_goals_progress": active_goals_data,
            "total_tasks_today": total_tasks_today,
            "completed_tasks_today": completed_tasks_today,
            "active_routine_tasks": active_routine_tasks_data,
            "recent_reflections": recent_reflections_data,
        }

        return Response(stats)

    def _calculate_current_streak(self, user, today):
        """
        Calcula sequencia atual de dias com 100% de cumprimento.

        Um dia conta para o streak se:
        1. Há instâncias de tarefas para aquele dia
        2. TODAS as instâncias foram completadas

        NOTA: Se uma instância não está completada, conta como não concluída.
        """
        streak = 0
        check_date = today
        max_lookback_days = 365  # Limitar a busca a 1 ano no passado
        days_without_tasks = 0

        for _ in range(max_lookback_days):
            # Buscar instâncias do dia
            day_instances = TaskInstance.objects.filter(
                owner__user=user, scheduled_date=check_date, deleted_at__isnull=True
            )

            total_instances = day_instances.count()

            if total_instances == 0:
                # Se não há instâncias para o dia, não quebra o streak
                days_without_tasks += 1
                # Se já passaram 30 dias sem tarefas, pare
                if days_without_tasks >= 30:
                    break
                check_date -= timedelta(days=1)
                continue

            # Reset contador de dias sem tarefas
            days_without_tasks = 0

            # Contar instâncias completadas
            completed_count = day_instances.filter(status="completed").count()

            # Para manter o streak, TODAS as instâncias devem estar completadas
            if completed_count == total_instances and completed_count > 0:
                streak += 1
                check_date -= timedelta(days=1)
            else:
                # Streak quebrado: alguma instância não foi completada
                break

        return streak

    def _calculate_best_streak(self, user):
        """Calcula a melhor sequencia de todos os tempos."""
        # Buscar todas as instâncias agrupadas por data
        instances = TaskInstance.objects.filter(
            owner__user=user, deleted_at__isnull=True
        ).order_by("scheduled_date")

        if not instances.exists():
            return 0

        # Agrupar instâncias por data
        from collections import defaultdict

        instances_by_date = defaultdict(list)
        for instance in instances:
            instances_by_date[instance.scheduled_date].append(instance)

        # Obter todas as datas únicas ordenadas
        all_dates = sorted(instances_by_date.keys())

        best_streak = 0
        current_streak = 0

        # Iterar por todas as datas desde a primeira até a última
        if all_dates:
            start_date = all_dates[0]
            end_date = all_dates[-1]
            check_date = start_date

            while check_date <= end_date:
                day_instances = instances_by_date.get(check_date, [])

                # Se não há instâncias para o dia, não afeta o streak
                if not day_instances:
                    check_date += timedelta(days=1)
                    continue

                # Verificar quantas instâncias foram completadas
                completed_count = sum(
                    1 for i in day_instances if i.status == "completed"
                )
                expected_count = len(day_instances)

                # Se todas as instâncias foram completadas, incrementar streak
                if completed_count == expected_count and completed_count > 0:
                    current_streak += 1
                    best_streak = max(best_streak, current_streak)
                else:
                    # Streak quebrado
                    current_streak = 0

                check_date += timedelta(days=1)

        return best_streak


# ============================================================================
# TASK INSTANCE VIEWS
# ============================================================================


class TaskInstanceListCreateView(BaseListCreateView):
    """Lista todas as instancias de tarefas ou cria uma nova (tarefa avulsa)."""

    def get_queryset(self):
        qs = TaskInstance.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "template")

        # Filtro por data
        date_param = self.request.query_params.get("date")
        if date_param:
            try:
                filter_date = date.fromisoformat(date_param)
                qs = qs.filter(scheduled_date=filter_date)
            except ValueError:
                pass

        # Filtro por status
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        # Filtro por template
        template_id = self.request.query_params.get("template")
        if template_id:
            qs = qs.filter(template_id=template_id)

        return qs.order_by("scheduled_date", "scheduled_time", "occurrence_index")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TaskInstanceCreateSerializer
        return TaskInstanceSerializer

    def perform_create(self, serializer):
        instance = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request,
            "create",
            "TaskInstance",
            instance.id,
            f"Criou tarefa avulsa: {instance.task_name}",
        )


class TaskInstanceDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma instancia de tarefa."""

    def get_queryset(self):
        return TaskInstance.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "template")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return TaskInstanceUpdateSerializer
        return TaskInstanceSerializer

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            "update",
            "TaskInstance",
            instance.id,
            f"Atualizou instancia: {instance.task_name} - {instance.status}",
        )

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save()
        log_activity(
            self.request,
            "delete",
            "TaskInstance",
            instance.id,
            f"Deletou instancia: {instance.task_name}",
        )


class InstancesForDateView(APIView):
    """
    GET /api/v1/personal-planning/instances/for-date/?date=YYYY-MM-DD&sync=true

    Retorna todas as instancias para uma data, gerando-as se necessario.
    Este endpoint implementa a geracao lazy de instancias.

    Query params:
    - date: Data no formato YYYY-MM-DD (obrigatório)
    - sync: Se 'true', sincroniza instâncias pendentes com dados atuais do template
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_param = request.query_params.get("date")
        sync_param = request.query_params.get("sync", "false").lower() == "true"

        if not date_param:
            return Response(
                {"error": "Parametro date e obrigatorio"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_date = date.fromisoformat(date_param)
        except ValueError:
            return Response(
                {"error": "Formato de data invalido. Use YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Obter member do usuario
        member = Member.objects.filter(user=request.user).first()
        if not member:
            return Response(
                {"error": "Membro nao encontrado"}, status=status.HTTP_404_NOT_FOUND
            )

        # Gerar instancias (lazy generation)
        # Se sync=true, atualiza instâncias pendentes com dados do template
        from personal_planning.services.instance_generator import InstanceGenerator

        instances = InstanceGenerator.generate_for_date(
            member, target_date, force_regenerate=sync_param
        )

        serializer = TaskInstanceSerializer(instances, many=True)

        # Calcular resumo
        total = len(instances)
        completed = sum(1 for i in instances if i.status == "completed")
        in_progress = sum(1 for i in instances if i.status == "in_progress")
        skipped = sum(1 for i in instances if i.status == "skipped")

        return Response(
            {
                "date": date_param,
                "instances": serializer.data,
                "summary": {
                    "total": total,
                    "completed": completed,
                    "in_progress": in_progress,
                    "pending": total - completed - in_progress - skipped,
                    "skipped": skipped,
                    "completion_rate": (
                        round((completed / total * 100), 1) if total > 0 else 0
                    ),
                },
            }
        )


class TaskInstanceStatusUpdateView(APIView):
    """
    PATCH /api/v1/personal-planning/instances/<id>/status/

    Endpoint rapido para atualizar apenas o status de uma instancia.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            instance = TaskInstance.objects.get(
                pk=pk, owner__user=request.user, deleted_at__isnull=True
            )
        except TaskInstance.DoesNotExist:
            return Response(
                {"error": "Instancia nao encontrada"}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = TaskInstanceStatusUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_status = serializer.validated_data["status"]
        notes = serializer.validated_data.get("notes")

        # Atualizar instancia
        instance.status = new_status
        if notes:
            instance.notes = notes
        instance.updated_by = request.user
        instance.save()

        log_activity(
            request,
            "update",
            "TaskInstance",
            instance.id,
            f"Atualizou status: {instance.task_name} -> {new_status}",
        )

        return Response(TaskInstanceSerializer(instance).data)


class TaskInstanceBulkUpdateView(APIView):
    """
    POST /api/v1/personal-planning/instances/bulk-update/

    Atualiza multiplas instancias de uma vez (util para salvar o kanban).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        updates = request.data.get("updates", [])
        if not updates:
            return Response(
                {"error": "Lista de atualizacoes vazia"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated_instances = []
        errors = []

        for update in updates:
            instance_id = update.get("id")
            new_status = update.get("status")
            notes = update.get("notes")

            if not instance_id or not new_status:
                errors.append(
                    {"id": instance_id, "error": "id e status sao obrigatorios"}
                )
                continue

            try:
                instance = TaskInstance.objects.get(
                    pk=instance_id, owner__user=request.user, deleted_at__isnull=True
                )
                instance.status = new_status
                if notes is not None:
                    instance.notes = notes
                instance.updated_by = request.user
                instance.save()
                updated_instances.append(instance)
            except TaskInstance.DoesNotExist:
                errors.append({"id": instance_id, "error": "Instancia nao encontrada"})

        return Response(
            {
                "updated_count": len(updated_instances),
                "updated": TaskInstanceSerializer(updated_instances, many=True).data,
                "errors": errors,
            }
        )
