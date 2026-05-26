import json
from datetime import date, timedelta
from pathlib import Path

from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from members.models import Member
from personal_planning.models import (
    DailyReflection,
    Exercise,
    Food,
    GamificationProfile,
    Goal,
    MealLog,
    MealType,
    MenuOption,
    MenuOptionIngredient,
    RoutineTask,
    TaskInstance,
    UserBadge,
    WorkoutDay,
    WorkoutExercise,
    WorkoutPlan,
    WorkoutSession,
    WorkoutSessionExercise,
    WorkoutSessionSet,
)
from personal_planning.serializers import (
    DailyReflectionCreateUpdateSerializer,
    DailyReflectionSerializer,
    ExerciseCreateUpdateSerializer,
    ExerciseSerializer,
    FoodCreateUpdateSerializer,
    FoodSerializer,
    GoalCreateUpdateSerializer,
    GoalSerializer,
    MealLogCreateUpdateSerializer,
    MealLogSerializer,
    MealTypeCreateUpdateSerializer,
    MealTypeSerializer,
    MenuOptionCreateUpdateSerializer,
    MenuOptionIngredientCreateUpdateSerializer,
    MenuOptionIngredientSerializer,
    MenuOptionSerializer,
    RoutineTaskCreateUpdateSerializer,
    RoutineTaskSerializer,
    TaskInstanceCreateSerializer,
    TaskInstanceSerializer,
    TaskInstanceStatusUpdateSerializer,
    TaskInstanceUpdateSerializer,
    WorkoutDayCreateUpdateSerializer,
    WorkoutDaySerializer,
    WorkoutExerciseCreateUpdateSerializer,
    WorkoutExerciseSerializer,
    WorkoutPlanCreateUpdateSerializer,
    WorkoutPlanSerializer,
    WorkoutSessionCreateUpdateSerializer,
    WorkoutSessionExerciseCreateUpdateSerializer,
    WorkoutSessionExerciseSerializer,
    WorkoutSessionSerializer,
    WorkoutSessionSetCreateUpdateSerializer,
    WorkoutSessionSetSerializer,
)


def log_activity(
    request,
    action,
    model_name,
    object_id,
    description,
    description_key=None,
    description_params=None,
):
    """Helper para registrar atividades."""
    try:
        from security.models import ActivityLog

        ActivityLog.log_action(
            user=request.user,
            action=action,
            description=description,
            description_key=description_key,
            description_params=description_params,
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
            description_key="routine_task.create",
            description_params={"name": task.name},
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
            description_key="routine_task.update",
            description_params={"name": task.name},
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
            description_key="routine_task.delete",
            description_params={"name": instance.name},
        )


# ============================================================================
# ROUTINE TEMPLATE VIEWS
# ============================================================================

_TEMPLATES_FIXTURE = (
    Path(__file__).resolve().parent / "fixtures" / "routine_templates.json"
)


def _load_templates():
    """Carrega os templates de rotina do arquivo JSON."""
    with open(_TEMPLATES_FIXTURE, encoding="utf-8") as f:
        return json.load(f)


class RoutineTemplateListView(APIView):
    """Retorna a lista de templates de rotina disponíveis (somente leitura)."""

    permission_classes = (IsAuthenticated,)
    queryset = RoutineTask.objects.none()

    def get(self, request):
        templates = _load_templates()
        # Retorna somente metadados (sem tarefas internas para a listagem)
        result = [
            {
                "id": t["id"],
                "name": t["name"],
                "description": t["description"],
                "icon": t["icon"],
                "task_count": len(t["tasks"]),
                "tasks": t["tasks"],
            }
            for t in templates
        ]
        return Response(result)


class RoutineTemplateImportView(APIView):
    """Importa um template de rotina criando RoutineTasks
    para o usuário autenticado."""

    permission_classes = (IsAuthenticated,)
    queryset = RoutineTask.objects.none()

    def post(self, request):
        template_id = request.data.get("template_id")
        if not template_id:
            return Response(
                {"detail": "O campo 'template_id' é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        templates = _load_templates()
        template = next((t for t in templates if t["id"] == template_id), None)
        if template is None:
            return Response(
                {"detail": "Template não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            owner = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            return Response(
                {"detail": "Perfil de membro não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_names = set(
            RoutineTask.objects.filter(
                owner=owner, deleted_at__isnull=True
            ).values_list("name", flat=True)
        )

        created_ids = []
        skipped_names = []

        for task_data in template["tasks"]:
            task_name = task_data["name"]
            if task_name in existing_names:
                skipped_names.append(task_name)
                continue

            task = RoutineTask(
                name=task_name,
                description=task_data.get("description", ""),
                category=task_data.get("category", "other"),
                icon=task_data.get("icon"),
                periodicity=task_data.get("periodicity", "daily"),
                weekday=task_data.get("weekday"),
                day_of_month=task_data.get("day_of_month"),
                custom_weekdays=task_data.get("custom_weekdays"),
                custom_month_days=task_data.get("custom_month_days"),
                times_per_week=task_data.get("times_per_week"),
                times_per_month=task_data.get("times_per_month"),
                interval_days=task_data.get("interval_days"),
                interval_start_date=task_data.get("interval_start_date"),
                target_quantity=task_data.get("target_quantity", 1),
                unit=task_data.get("unit", "vez"),
                default_time=task_data.get("default_time"),
                daily_occurrences=task_data.get("daily_occurrences", 1),
                interval_hours=task_data.get("interval_hours"),
                scheduled_times=task_data.get("scheduled_times"),
                is_active=task_data.get("is_active", True),
                owner=owner,
                created_by=request.user,
                updated_by=request.user,
            )
            task.full_clean()
            task.save()
            created_ids.append(task.id)
            log_activity(
                request,
                "create",
                "RoutineTask",
                task.id,
                f"Importou tarefa do template"
                f" '{template['name']}': {task.name}",
                description_key="routine_task.import_template",
                description_params={
                    "task_name": task.name,
                    "template_name": template["name"],
                },
            )

        return Response(
            {
                "created_ids": created_ids,
                "skipped_names": skipped_names,
                "template_name": template["name"],
            },
            status=status.HTTP_201_CREATED,
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
            self.request,
            "create",
            "Goal",
            goal.id,
            f"Criou objetivo: {goal.title}",
            description_key="goal.create",
            description_params={"title": goal.title},
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
            self.request,
            "update",
            "Goal",
            goal.id,
            f"Atualizou objetivo: {goal.title}",
            description_key="goal.update",
            description_params={"title": goal.title},
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
            description_key="goal.delete",
            description_params={"title": instance.title},
        )


class GoalRecalculateView(APIView):
    """
    Recalcula o progresso do objetivo usando calculated_current_value
    e atualiza status se a meta foi atingida.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            goal = Goal.objects.get(
                pk=pk, owner__user=request.user, deleted_at__isnull=True
            )
        except Goal.DoesNotExist:
            return Response(
                {"detail": "Objetivo não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if goal.goal_type not in (
            "consecutive_days",
            "total_days",
            "avoid_habit",
        ):
            return Response(
                {
                    "detail": (
                        "Recálculo automático só está"
                        " disponível para objetivos"
                        " de dias consecutivos,"
                        " total de dias ou evitar hábito."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        current = goal.calculated_current_value
        update_fields = ["updated_at"]

        if current >= goal.target_value and goal.status == "active":
            goal.status = "completed"
            goal.end_date = timezone.now().date()
            update_fields += ["status", "end_date"]

        goal.save(update_fields=update_fields)

        log_activity(
            request,
            "update",
            "Goal",
            goal.id,
            f"Recalculou progresso do objetivo: {goal.title}",
            description_key="goal.recalculate",
            description_params={"title": goal.title},
        )

        serializer = GoalSerializer(goal)
        return Response(serializer.data)


class GoalRestartView(APIView):
    """
    Reinicia totalmente o progresso do objetivo.
    Define start_date = amanha para garantir progresso 0 imediato,
    zera current_value e reativa o objetivo.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from datetime import timedelta

        try:
            goal = Goal.objects.get(
                pk=pk, owner__user=request.user, deleted_at__isnull=True
            )
        except Goal.DoesNotExist:
            return Response(
                {"detail": "Objetivo não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        goal.current_value = 0
        goal.start_date = timezone.now().date() + timedelta(days=1)
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
            f"Reiniciou progresso do objetivo: {goal.title}",
            description_key="goal.restart",
            description_params={"title": goal.title},
        )

        serializer = GoalSerializer(goal)
        return Response(serializer.data)


class GoalRegisterFailureView(APIView):
    """
    Registra uma falha no objetivo a partir de uma data informada.
    Define start_date = failure_date para que o progresso seja recalculado
    desde essa data, preservando o historico anterior.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            goal = Goal.objects.get(
                pk=pk, owner__user=request.user, deleted_at__isnull=True
            )
        except Goal.DoesNotExist:
            return Response(
                {"detail": "Objetivo não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        failure_date_str = request.data.get("failure_date")
        if not failure_date_str:
            return Response(
                {"detail": "O campo 'failure_date' é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from datetime import date

            failure_date = date.fromisoformat(failure_date_str)
        except ValueError:
            return Response(
                {"detail": "Formato de data inválido. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.now().date()
        if failure_date > today:
            return Response(
                {"detail": "A data da falha não pode ser no futuro."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        goal.start_date = failure_date
        goal.current_value = 0
        goal.end_date = None
        goal.status = "active"
        goal.save(
            update_fields=[
                "start_date",
                "current_value",
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
            f"Registrou falha no objetivo: {goal.title} em {failure_date}",
            description_key="goal.register_failure",
            description_params={"title": goal.title, "date": failure_date_str},
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
            description_key="reflection.create",
            description_params={"date": str(reflection.date)},
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
            description_key="reflection.update",
            description_params={"date": str(reflection.date)},
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
            description_key="reflection.delete",
            description_params={"date": str(instance.date)},
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
        tasks_qs = RoutineTask.objects.filter(
            owner__user=user, deleted_at__isnull=True
        )
        instances_qs = TaskInstance.objects.filter(
            owner__user=user, deleted_at__isnull=True
        )
        goals_qs = Goal.objects.filter(
            owner__user=user, deleted_at__isnull=True
        )

        # Contadores gerais
        total_tasks = tasks_qs.count()
        active_tasks = tasks_qs.filter(is_active=True).count()
        total_goals = goals_qs.count()
        active_goals = goals_qs.filter(status="active").count()
        completed_goals = goals_qs.filter(status="completed").count()

        # Taxa de cumprimento dos ultimos 7 dias
        seven_days_ago = today - timedelta(days=7)
        recent_instances = instances_qs.filter(
            scheduled_date__gte=seven_days_ago
        )
        total_recent = recent_instances.count()
        completed_recent = recent_instances.filter(status="completed").count()
        completion_rate_7d = (
            round((completed_recent / total_recent) * 100, 1)
            if total_recent > 0
            else 0.0
        )

        # Taxa de cumprimento dos ultimos 30 dias
        thirty_days_ago = today - timedelta(days=30)
        month_instances = instances_qs.filter(
            scheduled_date__gte=thirty_days_ago
        )
        total_month = month_instances.count()
        completed_month = month_instances.filter(status="completed").count()
        completion_rate_30d = (
            round((completed_month / total_month) * 100, 1)
            if total_month > 0
            else 0.0
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
                    "current_value": goal.calculated_current_value,
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
        completed_tasks_today = instances_today.filter(
            status="completed"
        ).count()

        # Tarefas rotineiras ativas (usar o serializer)
        from personal_planning.serializers import RoutineTaskSerializer

        active_routine_tasks_qs = tasks_qs.filter(
            is_active=True
        ).prefetch_related("instances")
        active_routine_tasks_data = RoutineTaskSerializer(
            active_routine_tasks_qs, many=True
        ).data

        # Reflexões recentes (últimas 5) - usar o serializer
        from personal_planning.serializers import DailyReflectionSerializer

        recent_reflections_qs = (
            DailyReflection.objects.filter(
                owner__user=user, deleted_at__isnull=True
            )
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
                owner__user=user,
                scheduled_date=check_date,
                deleted_at__isnull=True,
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
    """Lista todas as instancias de tarefas ou cria uma nova
    (tarefa avulsa)."""

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

        return qs.order_by(
            "scheduled_date", "scheduled_time", "occurrence_index"
        )

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
            description_key="task_instance.create",
            description_params={"name": instance.task_name},
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
            description_key="task_instance.update",
            description_params={
                "name": instance.task_name,
                "status": instance.status,
            },
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
            description_key="task_instance.delete",
            description_params={"name": instance.task_name},
        )


class InstancesForDateView(APIView):
    """
    GET /api/v1/personal-planning/instances/for-date/?date=YYYY-MM-DD&sync=true

    Retorna todas as instancias para uma data, gerando-as se necessario.
    Este endpoint implementa a geracao lazy de instancias.

    Query params:
    - date: Data no formato YYYY-MM-DD (obrigatório)
    - sync: Se 'true', sincroniza instâncias pendentes com dados atuais do
    template
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_param = request.query_params.get("date")
        sync_param = (
            request.query_params.get("sync", "false").lower() == "true"
        )

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
                {"error": "Membro nao encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Gerar instancias (lazy generation)
        # Se sync=true, atualiza instâncias pendentes com dados do template
        from personal_planning.services.instance_generator import (
            InstanceGenerator,
        )

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
                {"error": "Instancia nao encontrada"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TaskInstanceStatusUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors, status=status.HTTP_400_BAD_REQUEST
            )

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
            description_key="task_instance.update_status",
            description_params={
                "name": instance.task_name,
                "status": new_status,
            },
        )

        return Response(TaskInstanceSerializer(instance).data)


class RoutineTaskHeatmapView(APIView):
    """
    GET /api/v1/personal-planning/routine-tasks/heatmap/

    Retorna dados de consistencia diaria para o heatmap de habitos.

    Query params:
    - task_id: (opcional) ID da tarefa para filtrar.
      Se omitido, retorna dados globais.
    - year:    (opcional) Ano a exibir. Default: ano atual.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        task_id = request.query_params.get("task_id")
        year_param = request.query_params.get("year")
        today = timezone.now().date()

        try:
            year = int(year_param) if year_param else today.year
        except ValueError:
            return Response(
                {"error": "Parâmetro year inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        start_date = date(year, 1, 1)
        end_date = min(date(year, 12, 31), today)

        member = Member.objects.filter(user=request.user).first()
        if not member:
            return Response(
                {"error": "Membro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if task_id:
            try:
                task = RoutineTask.objects.get(
                    pk=task_id, owner=member, deleted_at__isnull=True
                )
            except RoutineTask.DoesNotExist:
                return Response(
                    {"error": "Tarefa não encontrada."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            data = self._build_task_heatmap(task, start_date, end_date)
            return Response(
                {
                    "year": year,
                    "task_id": str(task.id),
                    "task_name": task.name,
                    "data": data,
                }
            )

        data = self._build_general_heatmap(member, start_date, end_date)
        return Response(
            {"year": year, "task_id": None, "task_name": None, "data": data}
        )

    def _build_task_heatmap(self, task, start_date, end_date):
        completions_by_date = dict(
            TaskInstance.objects.filter(
                template=task,
                scheduled_date__gte=start_date,
                scheduled_date__lte=end_date,
                status="completed",
                deleted_at__isnull=True,
            )
            .values("scheduled_date")
            .annotate(count=Count("id"))
            .values_list("scheduled_date", "count")
        )

        data = []
        current = start_date
        while current <= end_date:
            is_scheduled = task.should_appear_on_date(current)
            completed = completions_by_date.get(current, 0)
            data.append(
                {
                    "date": current.isoformat(),
                    "completed": completed,
                    "expected": task.daily_occurrences if is_scheduled else 0,
                    "is_scheduled": is_scheduled,
                }
            )
            current += timedelta(days=1)
        return data

    def _build_general_heatmap(self, member, start_date, end_date):
        completions_by_date = dict(
            TaskInstance.objects.filter(
                owner=member,
                scheduled_date__gte=start_date,
                scheduled_date__lte=end_date,
                status="completed",
                deleted_at__isnull=True,
            )
            .values("scheduled_date")
            .annotate(count=Count("id"))
            .values_list("scheduled_date", "count")
        )
        totals_by_date = dict(
            TaskInstance.objects.filter(
                owner=member,
                scheduled_date__gte=start_date,
                scheduled_date__lte=end_date,
                deleted_at__isnull=True,
            )
            .values("scheduled_date")
            .annotate(count=Count("id"))
            .values_list("scheduled_date", "count")
        )

        data = []
        current = start_date
        while current <= end_date:
            expected = totals_by_date.get(current, 0)
            completed = completions_by_date.get(current, 0)
            data.append(
                {
                    "date": current.isoformat(),
                    "completed": completed,
                    "expected": expected,
                    "is_scheduled": expected > 0,
                }
            )
            current += timedelta(days=1)
        return data


class PersonalPlanningAnalyticsView(APIView):
    """
    GET /api/v1/personal-planning/analytics/

    Retorna análises de desempenho: distribuição por dia da semana,
    taxa de conclusão por dia, e insights automáticos de padrões.
    """

    permission_classes = [IsAuthenticated]

    WEEKDAY_NAMES = [
        "Segunda-feira",
        "Terça-feira",
        "Quarta-feira",
        "Quinta-feira",
        "Sexta-feira",
        "Sábado",
        "Domingo",
    ]

    def get(self, request):
        from collections import defaultdict

        user = request.user
        today = timezone.now().date()
        ninety_days_ago = today - timedelta(days=90)

        instances = TaskInstance.objects.filter(
            owner__user=user,
            scheduled_date__gte=ninety_days_ago,
            scheduled_date__lte=today,
            deleted_at__isnull=True,
        ).values("scheduled_date", "status")

        totals_by_weekday = defaultdict(int)
        completed_by_weekday = defaultdict(int)

        for inst in instances:
            wd = inst["scheduled_date"].weekday()
            totals_by_weekday[wd] += 1
            if inst["status"] == "completed":
                completed_by_weekday[wd] += 1

        completion_by_weekday = []
        for wd in range(7):
            total = totals_by_weekday[wd]
            completed = completed_by_weekday[wd]
            rate = round((completed / total) * 100, 1) if total > 0 else None
            completion_by_weekday.append(
                {
                    "weekday": wd,
                    "weekday_display": self.WEEKDAY_NAMES[wd],
                    "total": total,
                    "completed": completed,
                    "rate": rate,
                }
            )

        insights = self._generate_insights(completion_by_weekday)

        return Response(
            {
                "period_days": 90,
                "completion_by_weekday": completion_by_weekday,
                "insights": insights,
            }
        )

    def _generate_insights(self, by_weekday):
        insights = []
        days_with_data = [d for d in by_weekday if d["rate"] is not None]

        if not days_with_data:
            return insights

        best = max(days_with_data, key=lambda d: d["rate"])
        worst = min(days_with_data, key=lambda d: d["rate"])

        if best["rate"] >= 75:
            insights.append(
                {
                    "type": "best_day",
                    "weekday": best["weekday"],
                    "rate": round(best["rate"], 1),
                }
            )

        if worst["rate"] is not None and worst["rate"] < 50:
            insights.append(
                {
                    "type": "worst_day",
                    "weekday": worst["weekday"],
                    "rate": round(worst["rate"], 1),
                }
            )

        weekends = [
            d
            for d in by_weekday
            if d["weekday"] in (5, 6) and d["rate"] is not None
        ]
        weekdays = [
            d for d in by_weekday if d["weekday"] < 5 and d["rate"] is not None
        ]

        if weekends and weekdays:
            avg_weekend = sum(d["rate"] for d in weekends) / len(weekends)
            avg_weekday = sum(d["rate"] for d in weekdays) / len(weekdays)
            diff = avg_weekday - avg_weekend

            if diff > 20:
                insights.append(
                    {
                        "type": "weekend_drop",
                        "weekend_rate": round(avg_weekend, 1),
                        "weekday_rate": round(avg_weekday, 1),
                        "diff": round(diff, 1),
                    }
                )
            elif diff < -15:
                insights.append(
                    {
                        "type": "weekend_better",
                        "weekend_rate": round(avg_weekend, 1),
                        "weekday_rate": round(avg_weekday, 1),
                    }
                )

        all_rates = [d["rate"] for d in days_with_data]
        if all_rates:
            overall = sum(all_rates) / len(all_rates)
            if overall >= 80:
                insights.append(
                    {
                        "type": "overall_excellent",
                        "rate": round(overall, 1),
                    }
                )
            elif overall < 40:
                insights.append(
                    {
                        "type": "overall_low",
                        "rate": round(overall, 1),
                    }
                )

        return insights


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
                    {
                        "id": instance_id,
                        "error": "id e status sao obrigatorios",
                    }
                )
                continue

            try:
                instance = TaskInstance.objects.get(
                    pk=instance_id,
                    owner__user=request.user,
                    deleted_at__isnull=True,
                )
                instance.status = new_status
                if notes is not None:
                    instance.notes = notes
                instance.updated_by = request.user
                instance.save()
                updated_instances.append(instance)
            except TaskInstance.DoesNotExist:
                errors.append(
                    {"id": instance_id, "error": "Instancia nao encontrada"}
                )

        return Response(
            {
                "updated_count": len(updated_instances),
                "updated": TaskInstanceSerializer(
                    updated_instances, many=True
                ).data,
                "errors": errors,
            }
        )


class GamificationProfileView(APIView):
    """GET /api/v1/personal-planning/gamification/ — perfil de gamificação."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        member = Member.objects.filter(
            user=request.user, is_deleted=False
        ).first()
        if not member:
            return Response(
                {"detail": "Membro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        profile, _ = GamificationProfile.objects.get_or_create(
            member=member,
            defaults={"created_by": request.user},
        )

        badges = (
            UserBadge.objects.filter(profile=profile)
            .select_related("badge")
            .order_by("-earned_at")[:20]
        )
        recent_xp = profile.xp_transactions.order_by("-created_at")[:10]

        xp_next_level = GamificationProfile.xp_for_level(
            profile.current_level + 1
        )
        xp_current_level = GamificationProfile.xp_for_level(
            profile.current_level
        )
        xp_in_level = profile.total_xp - xp_current_level
        xp_needed = xp_next_level - xp_current_level
        progress_pct = round(
            (xp_in_level / xp_needed * 100) if xp_needed > 0 else 0, 1
        )

        return Response(
            {
                "total_xp": profile.total_xp,
                "current_level": profile.current_level,
                "current_streak": profile.current_streak,
                "longest_streak": profile.longest_streak,
                "tasks_completed_total": profile.tasks_completed_total,
                "xp_next_level": xp_next_level,
                "xp_in_level": xp_in_level,
                "xp_needed_for_next_level": xp_needed,
                "level_progress_pct": progress_pct,
                "badges": [
                    {
                        "slug": ub.badge.slug,
                        "name": ub.badge.name,
                        "description": ub.badge.description,
                        "icon": ub.badge.icon,
                        "category": ub.badge.category,
                        "earned_at": ub.earned_at.isoformat(),
                    }
                    for ub in badges
                ],
                "recent_xp": [
                    {
                        "amount": tx.amount,
                        "event": tx.event,
                        "description": tx.description,
                        "total_after": tx.total_after,
                        "created_at": tx.created_at.isoformat(),
                    }
                    for tx in recent_xp
                ],
            }
        )


# ============================================================================
# WORKOUT VIEWS
# ============================================================================


class ExerciseListCreateView(BaseListCreateView):
    serializer_class = ExerciseSerializer
    create_serializer_class = ExerciseCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return Exercise.objects.filter(owner=member, deleted_at__isnull=True)


class ExerciseRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    serializer_class = ExerciseSerializer
    create_serializer_class = ExerciseCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return Exercise.objects.filter(owner=member, deleted_at__isnull=True)


class WorkoutPlanListCreateView(BaseListCreateView):
    serializer_class = WorkoutPlanSerializer
    create_serializer_class = WorkoutPlanCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return WorkoutPlan.objects.filter(
            owner=member, deleted_at__isnull=True
        )


class WorkoutPlanRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    serializer_class = WorkoutPlanSerializer
    create_serializer_class = WorkoutPlanCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return WorkoutPlan.objects.filter(
            owner=member, deleted_at__isnull=True
        )


class WorkoutDayListCreateView(BaseListCreateView):
    serializer_class = WorkoutDaySerializer
    create_serializer_class = WorkoutDayCreateUpdateSerializer
    filterset_fields = ["plan", "owner"]

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        qs = WorkoutDay.objects.filter(owner=member, deleted_at__isnull=True)
        plan_id = self.request.query_params.get("plan")
        if plan_id:
            qs = qs.filter(plan_id=plan_id)
        return qs


class WorkoutDayRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    serializer_class = WorkoutDaySerializer
    create_serializer_class = WorkoutDayCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return WorkoutDay.objects.filter(owner=member, deleted_at__isnull=True)


class WorkoutExerciseListCreateView(BaseListCreateView):
    serializer_class = WorkoutExerciseSerializer
    create_serializer_class = WorkoutExerciseCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        qs = WorkoutExercise.objects.filter(
            owner=member, deleted_at__isnull=True
        )
        workout_day_id = self.request.query_params.get("workout_day")
        if workout_day_id:
            qs = qs.filter(workout_day_id=workout_day_id)
        return qs


class WorkoutExerciseRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    serializer_class = WorkoutExerciseSerializer
    create_serializer_class = WorkoutExerciseCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return WorkoutExercise.objects.filter(
            owner=member, deleted_at__isnull=True
        )


class WorkoutSessionListCreateView(BaseListCreateView):
    serializer_class = WorkoutSessionSerializer
    create_serializer_class = WorkoutSessionCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        qs = WorkoutSession.objects.filter(
            owner=member, deleted_at__isnull=True
        )
        workout_day_id = self.request.query_params.get("workout_day")
        if workout_day_id:
            qs = qs.filter(workout_day_id=workout_day_id)
        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs


class WorkoutSessionRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    serializer_class = WorkoutSessionSerializer
    create_serializer_class = WorkoutSessionCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return WorkoutSession.objects.filter(
            owner=member, deleted_at__isnull=True
        )


class WorkoutSessionExerciseListCreateView(BaseListCreateView):
    serializer_class = WorkoutSessionExerciseSerializer
    create_serializer_class = WorkoutSessionExerciseCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        qs = WorkoutSessionExercise.objects.filter(
            owner=member, deleted_at__isnull=True
        )
        session_id = self.request.query_params.get("session")
        if session_id:
            qs = qs.filter(session_id=session_id)
        return qs


class WorkoutSessionExerciseRetrieveUpdateDestroyView(
    BaseRetrieveUpdateDestroyView
):
    serializer_class = WorkoutSessionExerciseSerializer
    create_serializer_class = WorkoutSessionExerciseCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return WorkoutSessionExercise.objects.filter(
            owner=member, deleted_at__isnull=True
        )


class WorkoutSessionSetListCreateView(BaseListCreateView):
    serializer_class = WorkoutSessionSetSerializer
    create_serializer_class = WorkoutSessionSetCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        qs = WorkoutSessionSet.objects.filter(
            owner=member, deleted_at__isnull=True
        )
        session_exercise_id = self.request.query_params.get("session_exercise")
        if session_exercise_id:
            qs = qs.filter(session_exercise_id=session_exercise_id)
        return qs


class WorkoutSessionSetRetrieveUpdateDestroyView(
    BaseRetrieveUpdateDestroyView
):
    serializer_class = WorkoutSessionSetSerializer
    create_serializer_class = WorkoutSessionSetCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return WorkoutSessionSet.objects.filter(
            owner=member, deleted_at__isnull=True
        )


# ============================================================================
# NUTRITION VIEWS
# ============================================================================


class FoodListCreateView(BaseListCreateView):
    serializer_class = FoodSerializer
    create_serializer_class = FoodCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        qs = Food.objects.filter(owner=member, deleted_at__isnull=True)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        return qs


class FoodRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    serializer_class = FoodSerializer
    create_serializer_class = FoodCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return Food.objects.filter(owner=member, deleted_at__isnull=True)


class MealTypeListCreateView(BaseListCreateView):
    serializer_class = MealTypeSerializer
    create_serializer_class = MealTypeCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        qs = MealType.objects.filter(owner=member, deleted_at__isnull=True)
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")
        return qs


class MealTypeRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    serializer_class = MealTypeSerializer
    create_serializer_class = MealTypeCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return MealType.objects.filter(owner=member, deleted_at__isnull=True)


class MenuOptionListCreateView(BaseListCreateView):
    serializer_class = MenuOptionSerializer
    create_serializer_class = MenuOptionCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        qs = MenuOption.objects.filter(owner=member, deleted_at__isnull=True)
        meal_type_id = self.request.query_params.get("meal_type")
        if meal_type_id:
            qs = qs.filter(meal_type_id=meal_type_id)
        return qs


class MenuOptionRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    serializer_class = MenuOptionSerializer
    create_serializer_class = MenuOptionCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return MenuOption.objects.filter(owner=member, deleted_at__isnull=True)


class MenuOptionIngredientListCreateView(BaseListCreateView):
    serializer_class = MenuOptionIngredientSerializer
    create_serializer_class = MenuOptionIngredientCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        qs = MenuOptionIngredient.objects.filter(
            owner=member, deleted_at__isnull=True
        )
        menu_option_id = self.request.query_params.get("menu_option")
        if menu_option_id:
            qs = qs.filter(menu_option_id=menu_option_id)
        return qs


class MenuOptionIngredientRetrieveUpdateDestroyView(
    BaseRetrieveUpdateDestroyView
):
    serializer_class = MenuOptionIngredientSerializer
    create_serializer_class = MenuOptionIngredientCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return MenuOptionIngredient.objects.filter(
            owner=member, deleted_at__isnull=True
        )


class MealLogListCreateView(BaseListCreateView):
    serializer_class = MealLogSerializer
    create_serializer_class = MealLogCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        qs = MealLog.objects.filter(owner=member, deleted_at__isnull=True)
        date_param = self.request.query_params.get("date")
        if date_param:
            qs = qs.filter(date=date_param)
        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(date__lte=date_to)
        meal_type_id = self.request.query_params.get("meal_type")
        if meal_type_id:
            qs = qs.filter(meal_type_id=meal_type_id)
        return qs


class MealLogRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    serializer_class = MealLogSerializer
    create_serializer_class = MealLogCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return MealLog.objects.filter(owner=member, deleted_at__isnull=True)

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.is_deleted = True
        instance.save()
