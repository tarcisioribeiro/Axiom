import json
import logging
from datetime import date, timedelta
from pathlib import Path

from django.db.models import Count, Prefetch
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.export_utils import build_csv_response, build_pdf_response
from app.permissions import GlobalDefaultPermission
from app.throttles import ExportRateThrottle
from members.models import Member
from personal_planning.models import (
    AUTO_COMPLETION_GOAL_TYPES,
    BodyMetric,
    Challenge,
    DailyReflection,
    Exercise,
    ExerciseDatasetEntry,
    Food,
    GamificationProfile,
    Goal,
    GoalFailure,
    MealLog,
    MealType,
    MenuOption,
    MenuOptionIngredient,
    RoutineTask,
    TaskInstance,
    UserBadge,
    UserRoutineTemplate,
    WorkoutDay,
    WorkoutExercise,
    WorkoutPlan,
    WorkoutSession,
    WorkoutSessionExercise,
    WorkoutSessionSet,
)
from personal_planning.serializers import (
    BodyMetricCreateUpdateSerializer,
    BodyMetricSerializer,
    ChallengeCreateUpdateSerializer,
    ChallengeSerializer,
    DailyReflectionCreateUpdateSerializer,
    DailyReflectionSerializer,
    ExerciseCreateUpdateSerializer,
    ExerciseDatasetEntrySerializer,
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

logger = logging.getLogger(__name__)


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
# USER ROUTINE TEMPLATE VIEWS
# ============================================================================


class UserRoutineTemplateListCreateView(BaseListCreateView):
    """Lista os templates de rotina do usuário ou cria um novo."""

    queryset = UserRoutineTemplate.objects.all()

    def get_queryset(self):
        return UserRoutineTemplate.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner")

    def get_serializer_class(self):
        from personal_planning.serializers import (
            UserRoutineTemplateCreateUpdateSerializer,
            UserRoutineTemplateSerializer,
        )

        if self.request.method == "POST":
            return UserRoutineTemplateCreateUpdateSerializer
        return UserRoutineTemplateSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class UserRoutineTemplateDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um template de rotina do usuário."""

    queryset = UserRoutineTemplate.objects.all()

    def get_queryset(self):
        return UserRoutineTemplate.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner")

    def get_serializer_class(self):
        from personal_planning.serializers import (
            UserRoutineTemplateCreateUpdateSerializer,
            UserRoutineTemplateSerializer,
        )

        if self.request.method in ["PUT", "PATCH"]:
            return UserRoutineTemplateCreateUpdateSerializer
        return UserRoutineTemplateSerializer

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save()


class UserRoutineTemplateImportView(APIView):
    """Importa um template de rotina do usuário, criando RoutineTasks."""

    permission_classes = (IsAuthenticated,)
    queryset = UserRoutineTemplate.objects.none()

    def post(self, request, pk: int):
        try:
            template = UserRoutineTemplate.objects.get(
                pk=pk, owner__user=request.user, deleted_at__isnull=True
            )
        except UserRoutineTemplate.DoesNotExist:
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

        for task_data in template.tasks:
            task_name = task_data.get("name", "")
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
                target_quantity=task_data.get("target_quantity", 1),
                unit=task_data.get("unit", "vez"),
                default_time=task_data.get("default_time"),
                priority=task_data.get("priority", "medium"),
                owner=owner,
                created_by=request.user,
                updated_by=request.user,
            )
            task.save()
            created_ids.append(task.id)

        return Response(
            {
                "created_ids": created_ids,
                "skipped_names": skipped_names,
                "template_name": template.name,
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

        if goal.goal_type not in AUTO_COMPLETION_GOAL_TYPES:
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

        goal.evaluate_completion()

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

        streak_before_failure = goal.calculated_current_value

        GoalFailure.objects.create(
            goal=goal,
            failure_date=failure_date,
            streak_at_failure=streak_before_failure,
            created_by=request.user,
            updated_by=request.user,
        )

        # `end_date` so representa um prazo fixo definido pelo usuario
        # quando o objetivo ainda esta ativo. Quando o objetivo ja estava
        # "completed", `end_date` guarda a data em que ele foi concluido
        # (nao um prazo) e deve ser descartada normalmente ao reativar.
        has_fixed_deadline = goal.status == "active" and goal.end_date

        goal.best_streak = max(goal.best_streak, streak_before_failure)
        goal.current_value = 0
        goal.status = "active"
        update_fields = [
            "best_streak",
            "current_value",
            "status",
            "start_date",
            "updated_at",
        ]

        if has_fixed_deadline:
            # Objetivo com prazo fixo: recomeça a contagem hoje, mas
            # recalcula a meta para os dias restantes até o prazo original
            # em vez de descartá-lo.
            remaining_days = (goal.end_date - today).days
            goal.start_date = today
            goal.target_value = max(remaining_days, 1)
            update_fields.append("target_value")
        else:
            # Sem prazo fixo (ou reativando um objetivo já concluído):
            # reinicia a contagem a partir da data da falha e limpa
            # end_date, preservando o comportamento anterior.
            goal.start_date = failure_date
            goal.end_date = None
            update_fields.append("end_date")

        goal.save(update_fields=update_fields)

        log_activity(
            request,
            "update",
            "Goal",
            goal.id,
            (
                f"Registrou falha no objetivo: {goal.title} em"
                f" {failure_date} (sequência alcançada:"
                f" {streak_before_failure})"
            ),
            description_key="goal.register_failure",
            description_params={
                "title": goal.title,
                "date": failure_date_str,
                "streak": streak_before_failure,
            },
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
        # Filtro por data (exata ou intervalo)
        date_param = self.request.query_params.get("date")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        self._ensure_instances_generated(date_param, date_from, date_to)

        qs = TaskInstance.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "template")

        if date_param:
            try:
                filter_date = date.fromisoformat(date_param)
                qs = qs.filter(scheduled_date=filter_date)
            except ValueError:
                pass
        elif date_from or date_to:
            try:
                if date_from:
                    qs = qs.filter(
                        scheduled_date__gte=date.fromisoformat(date_from)
                    )
                if date_to:
                    qs = qs.filter(
                        scheduled_date__lte=date.fromisoformat(date_to)
                    )
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

    def _ensure_instances_generated(self, date_param, date_from, date_to):
        """Gera (lazy) as instancias de rotina para o intervalo consultado.

        Sem isso, dias que o usuario nunca abriu na Rotina Diaria (que e
        quem normalmente dispara a geracao via InstancesForDateView) nunca
        ganham TaskInstance no banco, entao somem da grade do Planejamento
        Semanal mesmo tendo templates de rotina ativos.
        """
        try:
            if date_param:
                start = end = date.fromisoformat(date_param)
            elif date_from or date_to:
                start = date.fromisoformat(date_from) if date_from else None
                end = date.fromisoformat(date_to) if date_to else None
            else:
                return
        except ValueError:
            return

        if not start or not end or end < start:
            return

        # Limite de seguranca para evitar geracao em massa por engano
        if (end - start).days > 62:
            return

        member = Member.objects.filter(user=self.request.user).first()
        if not member:
            return

        from personal_planning.services.instance_generator import (
            InstanceGenerator,
        )

        current = start
        while current <= end:
            InstanceGenerator.generate_for_date(member, current)
            current += timedelta(days=1)

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
        category = request.query_params.get("category")
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

        data = self._build_general_heatmap(
            member, start_date, end_date, category=category
        )
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

    def _build_general_heatmap(
        self, member, start_date, end_date, category=None
    ):
        base_qs = TaskInstance.objects.filter(
            owner=member,
            scheduled_date__gte=start_date,
            scheduled_date__lte=end_date,
            deleted_at__isnull=True,
        )
        if category:
            base_qs = base_qs.filter(template__category=category)

        completions_by_date = dict(
            base_qs.filter(status="completed")
            .values("scheduled_date")
            .annotate(count=Count("id"))
            .values_list("scheduled_date", "count")
        )
        totals_by_date = dict(
            base_qs.values("scheduled_date")
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
        return Exercise.objects.filter(
            owner=member, deleted_at__isnull=True
        ).select_related("dataset_entry")


class ExerciseRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    serializer_class = ExerciseSerializer
    create_serializer_class = ExerciseCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return Exercise.objects.filter(
            owner=member, deleted_at__isnull=True
        ).select_related("dataset_entry")


class ExerciseGifStreamView(APIView):
    """Redireciona para o GIF do exercício (ver docstring de
    BookCoverStreamView, apps/api/library/views.py)."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Exercise.objects.all()

    def get(self, request, pk):
        try:
            exercise = Exercise.objects.select_related("dataset_entry").get(
                pk=pk, owner__user=request.user, deleted_at__isnull=True
            )
        except Exercise.DoesNotExist:
            return Response(
                {"detail": "Exercício não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not exercise.dataset_entry or not exercise.dataset_entry.gif:
            return Response(
                {"detail": "Este exercício não possui GIF."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            url = exercise.dataset_entry.gif.url
        except Exception:
            return Response(
                {"detail": "Arquivo não encontrado no sistema de arquivos."},
                status=status.HTTP_404_NOT_FOUND,
            )
        response = HttpResponseRedirect(url)
        response["Cache-Control"] = "private, max-age=3600"
        return response


class ExerciseThumbnailStreamView(APIView):
    """Redireciona para a miniatura do exercício (ver docstring de
    BookCoverStreamView, apps/api/library/views.py)."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Exercise.objects.all()

    def get(self, request, pk):
        try:
            exercise = Exercise.objects.select_related("dataset_entry").get(
                pk=pk, owner__user=request.user, deleted_at__isnull=True
            )
        except Exercise.DoesNotExist:
            return Response(
                {"detail": "Exercício não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not exercise.dataset_entry or not exercise.dataset_entry.thumbnail:
            return Response(
                {"detail": "Este exercício não possui miniatura."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            url = exercise.dataset_entry.thumbnail.url
        except Exception:
            return Response(
                {"detail": "Arquivo não encontrado no sistema de arquivos."},
                status=status.HTTP_404_NOT_FOUND,
            )
        response = HttpResponseRedirect(url)
        response["Cache-Control"] = "private, max-age=3600"
        return response


class ExerciseDatasetEntryListView(generics.ListAPIView):
    """Busca somente-leitura no catálogo vendorizado do dataset
    hasaneyldrm/exercises-dataset — usada pelo picker de imagens de
    exercícios. Dado global compartilhado (sem escopo por owner)."""

    serializer_class = ExerciseDatasetEntrySerializer
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)

    def get_queryset(self):
        qs = ExerciseDatasetEntry.objects.filter(deleted_at__isnull=True)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        for param in ("category", "body_part", "target", "equipment"):
            value = self.request.query_params.get(param)
            if value:
                qs = qs.filter(**{param: value})
        return qs


class ExerciseDatasetGifStreamView(APIView):
    """Redireciona para o GIF de uma entrada do dataset — usada pelo grid
    de resultados do picker, antes de qualquer seleção. Sem checagem de
    dono: é dado de referência compartilhado entre usuários autenticados."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = ExerciseDatasetEntry.objects.all()

    def get(self, request, pk):
        try:
            entry = ExerciseDatasetEntry.objects.get(
                pk=pk, deleted_at__isnull=True
            )
        except ExerciseDatasetEntry.DoesNotExist:
            return Response(
                {"detail": "Entrada do dataset não encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not entry.gif:
            return Response(
                {"detail": "Esta entrada não possui GIF."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            url = entry.gif.url
        except Exception:
            return Response(
                {"detail": "Arquivo não encontrado no sistema de arquivos."},
                status=status.HTTP_404_NOT_FOUND,
            )
        response = HttpResponseRedirect(url)
        response["Cache-Control"] = "private, max-age=3600"
        return response


class ExerciseDatasetThumbnailStreamView(APIView):
    """Redireciona para a miniatura de uma entrada do dataset (ver
    docstring de ExerciseDatasetGifStreamView)."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = ExerciseDatasetEntry.objects.all()

    def get(self, request, pk):
        try:
            entry = ExerciseDatasetEntry.objects.get(
                pk=pk, deleted_at__isnull=True
            )
        except ExerciseDatasetEntry.DoesNotExist:
            return Response(
                {"detail": "Entrada do dataset não encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not entry.thumbnail:
            return Response(
                {"detail": "Esta entrada não possui miniatura."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            url = entry.thumbnail.url
        except Exception:
            return Response(
                {"detail": "Arquivo não encontrado no sistema de arquivos."},
                status=status.HTTP_404_NOT_FOUND,
            )
        response = HttpResponseRedirect(url)
        response["Cache-Control"] = "private, max-age=3600"
        return response


class WorkoutPlanListCreateView(BaseListCreateView):
    serializer_class = WorkoutPlanSerializer
    create_serializer_class = WorkoutPlanCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return WorkoutPlan.objects.filter(
            owner=member, deleted_at__isnull=True
        ).prefetch_related(
            Prefetch(
                "days",
                queryset=WorkoutDay.objects.filter(
                    deleted_at__isnull=True
                ).prefetch_related(
                    Prefetch(
                        "exercises",
                        queryset=WorkoutExercise.objects.filter(
                            deleted_at__isnull=True
                        ).select_related("exercise__dataset_entry"),
                    )
                ),
            )
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
        qs = WorkoutDay.objects.filter(
            owner=member, deleted_at__isnull=True
        ).prefetch_related(
            Prefetch(
                "exercises",
                queryset=WorkoutExercise.objects.filter(
                    deleted_at__isnull=True
                ).select_related("exercise__dataset_entry"),
            )
        )
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
        ).select_related("exercise__dataset_entry")
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
        ).select_related("exercise__dataset_entry")


class WorkoutSessionListCreateView(BaseListCreateView):
    serializer_class = WorkoutSessionSerializer
    create_serializer_class = WorkoutSessionCreateUpdateSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        qs = (
            WorkoutSession.objects.filter(
                owner=member, deleted_at__isnull=True
            )
            .select_related("workout_day")
            .prefetch_related(
                Prefetch(
                    "session_exercises",
                    queryset=WorkoutSessionExercise.objects.filter(
                        deleted_at__isnull=True
                    )
                    .select_related("exercise__exercise__dataset_entry")
                    .prefetch_related(
                        Prefetch(
                            "sets",
                            queryset=WorkoutSessionSet.objects.filter(
                                deleted_at__isnull=True
                            ),
                        )
                    ),
                )
            )
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
        ).select_related("exercise__exercise__dataset_entry")
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
        ).select_related("exercise__exercise__dataset_entry")


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
        qs = MealType.objects.filter(
            owner=member, deleted_at__isnull=True
        ).prefetch_related(
            Prefetch(
                "options",
                queryset=MenuOption.objects.filter(
                    deleted_at__isnull=True
                ).prefetch_related(
                    Prefetch(
                        "ingredients",
                        queryset=MenuOptionIngredient.objects.filter(
                            deleted_at__isnull=True
                        ).select_related("food"),
                    )
                ),
            )
        )
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
        qs = MealLog.objects.filter(
            owner=member, deleted_at__isnull=True
        ).select_related("meal_type", "menu_option")
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


# ============================================================================
# EXPORT VIEWS
# ============================================================================

PDF_ROW_LIMIT = 500


def _export_meta(request, date_from=None, date_to=None):
    """Monta o dict `meta` esperado por `build_pdf_response`."""
    return {
        "user_name": request.user.get_full_name() or request.user.username,
        "period": f"{date_from or 'início'} a {date_to or 'hoje'}",
    }


class ExportWorkoutSessionsView(APIView):
    """
    Exporta sessões de treino do usuário em CSV ou PDF.

    GET /api/v1/personal-planning/workout-sessions/export/
    ?export_format=csv|pdf&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
    """

    permission_classes = (IsAuthenticated,)
    throttle_classes = [ExportRateThrottle]

    def get(self, request):
        member = Member.objects.get(user=request.user)
        qs = (
            WorkoutSession.objects.filter(
                owner=member, deleted_at__isnull=True
            )
            .select_related("workout_day__plan")
            .order_by("-date")
        )

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        export_format = request.query_params.get(
            "export_format", "csv"
        ).lower()
        headers = [
            "Data",
            "Plano",
            "Divisão",
            "Início",
            "Fim",
            "Duração (min)",
            "Notas",
        ]

        def rows():
            for s in qs.iterator():
                plan_name = (
                    s.workout_day.plan.name
                    if s.workout_day and s.workout_day.plan
                    else ""
                )
                day_name = s.workout_day.name if s.workout_day else "Avulso"
                yield [
                    str(s.date),
                    plan_name,
                    day_name,
                    str(s.started_at or ""),
                    str(s.finished_at or ""),
                    str(s.duration_minutes or ""),
                    s.notes or "",
                ]

        if export_format == "pdf":
            count = qs.count()
            if count > PDF_ROW_LIMIT:
                return Response(
                    {
                        "error": (
                            f"Muitos registros ({count})." " Refine o período."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return build_pdf_response(
                title="Histórico de Treinos",
                headers=headers,
                rows=list(rows()),
                totals_row=None,
                meta=_export_meta(request, date_from, date_to),
                filename="treinos",
            )
        return build_csv_response(rows(), headers, "treinos")


class ExportMealLogsView(APIView):
    """
    Exporta logs nutricionais do usuário em CSV ou PDF.

    GET /api/v1/personal-planning/meal-logs/export/
    ?export_format=csv|pdf&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
    """

    permission_classes = (IsAuthenticated,)
    throttle_classes = [ExportRateThrottle]

    def get(self, request):
        member = Member.objects.get(user=request.user)
        qs = (
            MealLog.objects.filter(owner=member, deleted_at__isnull=True)
            .select_related("meal_type", "menu_option")
            .order_by("-date")
        )

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        export_format = request.query_params.get(
            "export_format", "csv"
        ).lower()
        headers = [
            "Data",
            "Horário",
            "Tipo de Refeição",
            "Opção",
            "Livre",
            "Notas",
        ]

        def rows():
            for log in qs.iterator():
                option_name = (
                    log.menu_option.name if log.menu_option else "Livre"
                )
                yield [
                    str(log.date),
                    str(log.time or ""),
                    log.meal_type.name,
                    option_name,
                    "Sim" if log.is_free_meal else "Não",
                    log.notes or "",
                ]

        if export_format == "pdf":
            count = qs.count()
            if count > PDF_ROW_LIMIT:
                return Response(
                    {
                        "error": (
                            f"Muitos registros ({count})." " Refine o período."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return build_pdf_response(
                title="Registros Nutricionais",
                headers=headers,
                rows=list(rows()),
                totals_row=None,
                meta=_export_meta(request, date_from, date_to),
                filename="nutricao",
            )
        return build_csv_response(rows(), headers, "nutricao")


class ExportReflectionsView(APIView):
    """
    Exporta reflexões diárias do usuário em CSV ou PDF.

    GET /api/v1/personal-planning/reflections/export/
    ?export_format=csv|pdf&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
    """

    permission_classes = (IsAuthenticated,)
    throttle_classes = [ExportRateThrottle]

    def get(self, request):
        member = Member.objects.get(user=request.user)
        qs = DailyReflection.objects.filter(
            owner=member, deleted_at__isnull=True
        ).order_by("-date")

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        export_format = request.query_params.get(
            "export_format", "csv"
        ).lower()
        headers = ["Data", "Humor", "Reflexão"]

        def rows():
            for r in qs.iterator():
                yield [str(r.date), r.mood or "", r.reflection]

        if export_format == "pdf":
            count = qs.count()
            if count > PDF_ROW_LIMIT:
                return Response(
                    {
                        "error": (
                            f"Muitos registros ({count})." " Refine o período."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return build_pdf_response(
                title="Reflexões Diárias",
                headers=headers,
                rows=list(rows()),
                totals_row=None,
                meta=_export_meta(request, date_from, date_to),
                filename="reflexoes",
            )
        return build_csv_response(rows(), headers, "reflexoes")


class ExportGoalsView(APIView):
    """
    Exporta metas do usuário em CSV ou PDF.

    GET /api/v1/personal-planning/goals/export/
    ?export_format=csv|pdf&status=active|completed|cancelled
    """

    permission_classes = (IsAuthenticated,)
    throttle_classes = [ExportRateThrottle]

    def get(self, request):
        member = Member.objects.get(user=request.user)
        qs = Goal.objects.filter(
            owner=member, deleted_at__isnull=True
        ).order_by("-created_at")

        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        export_format = request.query_params.get(
            "export_format", "csv"
        ).lower()
        headers = [
            "Título",
            "Descrição",
            "Status",
            "Progresso (%)",
            "Valor Atual",
            "Valor Alvo",
            "Início",
            "Prazo",
        ]

        def rows():
            for g in qs.iterator():
                yield [
                    g.title,
                    g.description or "",
                    g.status,
                    str(g.progress_percentage),
                    str(g.current_value),
                    str(g.target_value),
                    str(g.start_date),
                    str(g.end_date or ""),
                ]

        if export_format == "pdf":
            count = qs.count()
            if count > PDF_ROW_LIMIT:
                return Response(
                    {
                        "error": (
                            f"Muitos registros ({count})." " Refine o período."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return build_pdf_response(
                title="Progresso de Metas",
                headers=headers,
                rows=list(rows()),
                totals_row=None,
                meta={
                    "user_name": (
                        request.user.get_full_name() or request.user.username
                    ),
                    "period": f"Status: {status_filter or 'todos'}",
                },
                filename="metas",
            )
        return build_csv_response(rows(), headers, "metas")


# ============================================================================
# CHALLENGE VIEWS
# ============================================================================


class ChallengeListCreateView(BaseListCreateView):
    serializer_class = ChallengeSerializer

    def get_serializer_class(self):
        if self.request.method in ("POST",):
            return ChallengeCreateUpdateSerializer
        return ChallengeSerializer

    def get_queryset(self):
        member = Member.objects.filter(user=self.request.user).first()
        if not member:
            return Challenge.objects.none()
        qs = Challenge.objects.filter(
            owner=member, is_deleted=False
        ).select_related("owner", "template_task")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )


class ChallengeRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    serializer_class = ChallengeSerializer

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return ChallengeCreateUpdateSerializer
        return ChallengeSerializer

    def get_queryset(self):
        member = Member.objects.filter(user=self.request.user).first()
        if not member:
            return Challenge.objects.none()
        return Challenge.objects.filter(owner=member, is_deleted=False)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()


# ============================================================================
# BODY METRIC VIEWS
# ============================================================================


class BodyMetricListCreateView(BaseListCreateView):
    serializer_class = BodyMetricSerializer

    def get_serializer_class(self):
        if self.request.method in ("POST",):
            return BodyMetricCreateUpdateSerializer
        return BodyMetricSerializer

    def get_queryset(self):
        member = Member.objects.filter(user=self.request.user).first()
        if not member:
            return BodyMetric.objects.none()
        return BodyMetric.objects.filter(
            owner=member, is_deleted=False
        ).select_related("owner")

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )


class BodyMetricRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    serializer_class = BodyMetricSerializer

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return BodyMetricCreateUpdateSerializer
        return BodyMetricSerializer

    def get_queryset(self):
        member = Member.objects.filter(user=self.request.user).first()
        if not member:
            return BodyMetric.objects.none()
        return BodyMetric.objects.filter(owner=member, is_deleted=False)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()


# ============================================================================
# AI ROUTINE SUGGESTION VIEW
# ============================================================================


class AIRoutineSuggestionView(APIView):
    """POST /api/v1/personal-planning/ai-routine/ — sugestões via LLM."""

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        objective = request.data.get("objective", "")
        available_hours = request.data.get("available_hours", 1)
        focus_areas = request.data.get("focus_areas", [])

        if not objective:
            return Response(
                {"error": "O campo 'objetivo' é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            import json as _json

            from agents.core.llm_client import LLMClient

            client = LLMClient
            areas_str = ", ".join(focus_areas) if focus_areas else "geral"
            prompt = (
                "Crie sugestões de tarefas de rotina diária para alcançar:"
                f' "{objective}".\n'
                f"Áreas de foco: {areas_str}.\n"
                f"Tempo disponível por dia: {available_hours} hora(s).\n\n"
                "Responda SOMENTE com JSON válido neste formato"
                " (sem markdown):\n"
                '{"tasks": [{"name": "...", "description": "...", '
                '"frequency": "daily|weekly", "duration_minutes": N, '
                '"category": "health|work|learning|finance|wellbeing", '
                '"time_of_day": "morning|afternoon|evening"}]}\n\n'
                "Máximo 5 tarefas. Seja prático e específico."
            )
            resp = client.chat([{"role": "user", "content": prompt}])
            start = resp.find("{")
            end = resp.rfind("}") + 1
            if start != -1 and end > start:
                result = _json.loads(resp[start:end])
            else:
                result = {
                    "tasks": [],
                    "error": "Formato inválido retornado pelo LLM",
                }
        except Exception as exc:
            result = {"tasks": [], "error": str(exc)}

        return Response(result)


class AIWorkoutPlanGenerationView(APIView):
    """POST /api/v1/personal-planning/ai-workout-plan/ — gera plano."""

    permission_classes = (IsAuthenticated,)

    _PROMPT_TEMPLATE = """Crie um plano de treino completo em JSON para:
- Objetivo: {goal}
- Nível: {level}
- Equipamentos: {equipment}
- Dias por semana: {days_per_week}

Responda SOMENTE com JSON válido neste formato (sem markdown, sem explicações):
{{
  "name": "Nome do plano",
  "description": "Descrição curta do plano",
  "days": [
    {{
      "name": "Treino A",
      "muscle_groups": "Peito / Tríceps",
      "day_of_week": 0,
      "order": 0,
      "exercises": [
        {{
          "name": "Supino Reto",
          "sets": 4,
          "reps_min": 8,
          "reps_max": 12,
          "rest_seconds": 90,
          "notes": "Dica de execução"
        }}
      ]
    }}
  ]
}}

Gere exatamente {days_per_week} dias de treino.
Use day_of_week de 0 (Seg) a 6 (Dom).
Seja específico e prático para o nível informado."""

    def post(self, request):
        import json as _json

        goal = (request.data.get("goal") or "").strip()
        level = (request.data.get("level") or "iniciante").strip()
        equipment = (
            request.data.get("equipment") or "academia completa"
        ).strip()
        try:
            days_per_week = int(request.data.get("days_per_week", 3))
            days_per_week = max(1, min(days_per_week, 7))
        except (TypeError, ValueError):
            days_per_week = 3

        if not goal:
            return Response(
                {"error": "O campo 'goal' (objetivo) é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            member = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            return Response(
                {"error": "Perfil de membro não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prompt = self._PROMPT_TEMPLATE.format(
            goal=goal,
            level=level,
            equipment=equipment,
            days_per_week=days_per_week,
        )

        try:
            from agents.core.llm_client import LLMClient

            client = LLMClient
            raw = client.chat([{"role": "user", "content": prompt}])

            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start == -1 or end <= start:
                return Response(
                    {"error": "LLM retornou formato inválido."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            plan_data = _json.loads(raw[start:end])
        except Exception as exc:
            logger.exception("ai-workout-plan LLM call failed")
            return Response(
                {"error": f"Não foi possível gerar o plano: {exc}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Persist the generated plan
        try:
            plan = WorkoutPlan.objects.create(
                name=plan_data.get("name", f"Plano {goal[:30]}"),
                description=plan_data.get("description", ""),
                is_active=True,
                owner=member,
                created_by=request.user,
            )

            days_payload = plan_data.get("days", [])
            for order, day_data in enumerate(days_payload):
                day = WorkoutDay.objects.create(
                    plan=plan,
                    name=day_data.get("name", f"Treino {chr(65 + order)}"),
                    muscle_groups=day_data.get("muscle_groups", ""),
                    day_of_week=day_data.get("day_of_week"),
                    order=day_data.get("order", order),
                    owner=member,
                    created_by=request.user,
                )
                for ex_order, ex_data in enumerate(
                    day_data.get("exercises", [])
                ):
                    WorkoutExercise.objects.create(
                        workout_day=day,
                        name=ex_data.get("name", "Exercício"),
                        sets=ex_data.get("sets", 3),
                        reps_min=ex_data.get("reps_min", 8),
                        reps_max=ex_data.get("reps_max", 12),
                        rest_seconds=ex_data.get("rest_seconds"),
                        notes=ex_data.get("notes", ""),
                        order=ex_order,
                        owner=member,
                        created_by=request.user,
                    )

            return Response(
                {
                    "plan_id": plan.pk,
                    "name": plan.name,
                    "description": plan.description,
                    "days_created": len(days_payload),
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            logger.exception("ai-workout-plan persistence failed")
            return Response(
                {"error": f"Erro ao salvar o plano: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AIMenuPlanGenerationView(APIView):
    """POST /api/v1/personal-planning/ai-menu-plan/ — gera cardápio via LLM."""

    permission_classes = (IsAuthenticated,)

    _PROMPT_TEMPLATE = """Crie um cardápio semanal personalizado em JSON para:
- Objetivo calórico diário: {calories} kcal
- Preferências: {preferences}
- Restrições alimentares: {restrictions}
- Número de refeições por dia: {meals_per_day}

Responda SOMENTE com JSON válido neste formato (sem markdown, sem explicações):
{{
  "meal_types": [
    {{
      "name": "Café da Manhã",
      "suggested_time": "07:00",
      "order": 0,
      "options": [
        {{
          "name": "Aveia com banana e mel",
          "estimated_calories": 350,
          "macros_note": "Carboidratos complexos + potássio"
        }},
        {{
          "name": "Iogurte grego com granola e frutas vermelhas",
          "estimated_calories": 280,
          "macros_note": "Proteína + fibras"
        }}
      ]
    }}
  ]
}}

Gere exatamente {meals_per_day} tipos de refeição.
Cada tipo deve ter 2 opções variadas.
Seja prático, saboroso e alinhado com o objetivo calórico."""

    def post(self, request):
        import json as _json

        try:
            calories = int(request.data.get("calories", 2000))
        except (TypeError, ValueError):
            calories = 2000

        preferences = (
            request.data.get("preferences") or "sem preferência específica"
        ).strip()
        restrictions = (request.data.get("restrictions") or "nenhuma").strip()
        try:
            meals_per_day = int(request.data.get("meals_per_day", 3))
            meals_per_day = max(2, min(meals_per_day, 6))
        except (TypeError, ValueError):
            meals_per_day = 3

        try:
            member = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            return Response(
                {"error": "Perfil de membro não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prompt = self._PROMPT_TEMPLATE.format(
            calories=calories,
            preferences=preferences,
            restrictions=restrictions,
            meals_per_day=meals_per_day,
        )

        try:
            from agents.core.llm_client import LLMClient

            client = LLMClient
            raw = client.chat([{"role": "user", "content": prompt}])

            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start == -1 or end <= start:
                return Response(
                    {"error": "LLM retornou formato inválido."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            menu_data = _json.loads(raw[start:end])
        except Exception as exc:
            logger.exception("ai-menu-plan LLM call failed")
            return Response(
                {"error": f"Não foi possível gerar o cardápio: {exc}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            meal_types_created = 0
            options_created = 0

            for order, mt_data in enumerate(menu_data.get("meal_types", [])):
                suggested_time = mt_data.get("suggested_time")
                meal_type = MealType.objects.create(
                    name=mt_data.get("name", f"Refeição {order + 1}"),
                    suggested_time=suggested_time or None,
                    order=mt_data.get("order", order),
                    is_active=True,
                    owner=member,
                    created_by=request.user,
                )
                meal_types_created += 1

                for opt_order, opt_data in enumerate(
                    mt_data.get("options", [])
                ):
                    opt_name = opt_data.get("name", "Opção")
                    kcal = opt_data.get("estimated_calories")
                    note = opt_data.get("macros_note", "")
                    display_name = opt_name
                    if kcal:
                        display_name += f" (~{kcal} kcal)"
                    if note:
                        display_name += f" — {note}"

                    MenuOption.objects.create(
                        meal_type=meal_type,
                        name=display_name[:100],
                        order=opt_order,
                        owner=member,
                        created_by=request.user,
                    )
                    options_created += 1

            return Response(
                {
                    "meal_types_created": meal_types_created,
                    "options_created": options_created,
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            logger.exception("ai-menu-plan persistence failed")
            return Response(
                {"error": f"Erro ao salvar o cardápio: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ============================================================================
# DAILY CALORIC SUMMARY VIEW
# ============================================================================


class DailyCaloricSummaryView(APIView):
    """
    GET /api/v1/personal-planning/daily-caloric-summary/?date=YYYY-MM-DD

    Retorna o resumo calórico do dia integrando dieta, treino e medidas
    corporais.

    Fórmulas usadas:
      - TMB (Mifflin-St Jeor):
          Homem: 10*peso + 6.25*altura - 5*idade + 5
          Mulher: 10*peso + 6.25*altura - 5*idade - 161
      - TDEE = TMB × multiplicador_nivel_atividade
      - Kcal consumidas = soma das calorias dos ingredientes das refeições
          kcal_ingrediente = (quantidade / serving_size) * calories_per_serving
      - Kcal gastas no treino = MET_médio × peso_kg × (minutos / 60)
      - Saldo = consumido - (TDEE + gastos_treino)
    """

    permission_classes = [IsAuthenticated]

    _ACTIVITY_MULTIPLIER = {
        "sedentary": 1.2,
        "lightly_active": 1.375,
        "moderately_active": 1.55,
        "very_active": 1.725,
        "extremely_active": 1.9,
    }
    _DEFAULT_MET = 5.0

    def get(self, request):
        user = request.user

        # --- Data alvo ---
        date_str = request.query_params.get("date")
        try:
            target_date = (
                date.fromisoformat(date_str)
                if date_str
                else timezone.now().date()
            )
        except ValueError:
            return Response(
                {"error": "Parâmetro 'date' inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Membro e medidas corporais ---
        try:
            member = Member.objects.get(user=user)
        except Member.DoesNotExist:
            return Response(
                {"error": "Perfil de membro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        latest_metric = (
            BodyMetric.objects.filter(owner=member, is_deleted=False)
            .order_by("-measured_at")
            .first()
        )

        # --- TMB e TDEE ---
        bmr = None
        tdee = None
        weight_kg = None
        if (
            latest_metric
            and latest_metric.weight_kg
            and latest_metric.height_cm
            and member.age
        ):
            weight_kg = float(latest_metric.weight_kg)
            height_cm = float(latest_metric.height_cm)
            age = member.age
            if member.sex == "M":
                bmr = round(10 * weight_kg + 6.25 * height_cm - 5 * age + 5, 1)
            else:
                bmr = round(
                    10 * weight_kg + 6.25 * height_cm - 5 * age - 161, 1
                )
            multiplier = self._ACTIVITY_MULTIPLIER.get(
                member.activity_level, 1.2
            )
            tdee = round(bmr * multiplier, 1)

        # --- Calorias consumidas (refeições do dia) ---
        meal_logs = (
            MealLog.objects.filter(
                owner=member, date=target_date, is_deleted=False
            )
            .select_related("meal_type", "menu_option")
            .prefetch_related("menu_option__ingredients__food")
        )

        meals_summary = []
        total_consumed = 0.0

        for log in meal_logs:
            meal_kcal = 0.0
            if log.menu_option and not log.is_free_meal:
                for ingredient in log.menu_option.ingredients.filter(
                    is_deleted=False, is_optional=False
                ):
                    food = ingredient.food
                    if not food or not food.calories_per_serving:
                        continue
                    cal_per_serving = float(food.calories_per_serving)
                    if (
                        food.serving_size
                        and float(food.serving_size) > 0
                        and ingredient.quantity
                    ):
                        meal_kcal += (
                            float(ingredient.quantity)
                            / float(food.serving_size)
                        ) * cal_per_serving
                    elif ingredient.quantity:
                        meal_kcal += cal_per_serving

            meal_kcal = round(meal_kcal, 1)
            total_consumed += meal_kcal
            meals_summary.append(
                {
                    "meal_type": log.meal_type.name,
                    "meal_type_order": log.meal_type.order,
                    "is_free_meal": log.is_free_meal,
                    "calories": meal_kcal,
                    "logged_at": (
                        log.time.strftime("%H:%M") if log.time else None
                    ),
                }
            )

        meals_summary.sort(key=lambda x: x["meal_type_order"])
        total_consumed = round(total_consumed, 1)

        # --- Calorias gastas no treino ---
        sessions = WorkoutSession.objects.filter(
            owner=member, date=target_date, is_deleted=False
        ).prefetch_related("session_exercises__exercise__exercise")

        sessions_summary = []
        total_exercise_kcal = 0.0

        for session in sessions:
            duration = session.duration_minutes
            if not duration or duration <= 0:
                sessions_summary.append(
                    {
                        "name": (
                            session.workout_day.name
                            if session.workout_day
                            else "Treino livre"
                        ),
                        "duration_minutes": None,
                        "calories_burned": None,
                    }
                )
                continue

            met_values = []
            for wse in session.session_exercises.filter(is_deleted=False):
                plan_exercise = wse.exercise
                if plan_exercise and plan_exercise.exercise:
                    met_values.append(float(plan_exercise.exercise.met_value))

            avg_met = (
                (sum(met_values) / len(met_values))
                if met_values
                else self._DEFAULT_MET
            )
            session_kcal = round(
                avg_met * (weight_kg or 70.0) * (duration / 60), 1
            )
            total_exercise_kcal += session_kcal

            sessions_summary.append(
                {
                    "name": (
                        session.workout_day.name
                        if session.workout_day
                        else "Treino livre"
                    ),
                    "duration_minutes": duration,
                    "calories_burned": session_kcal,
                }
            )

        total_exercise_kcal = round(total_exercise_kcal, 1)

        # --- Saldo calórico ---
        net_calories = None
        if tdee is not None:
            net_calories = round(
                total_consumed - (tdee + total_exercise_kcal), 1
            )

        return Response(
            {
                "date": str(target_date),
                "bmr": bmr,
                "tdee": tdee,
                "activity_level": member.activity_level,
                "calories_consumed": total_consumed,
                "calories_burned_exercise": total_exercise_kcal,
                "net_calories": net_calories,
                "has_body_metrics": latest_metric is not None,
                "body_metrics": {
                    "weight_kg": (
                        float(latest_metric.weight_kg)
                        if latest_metric and latest_metric.weight_kg
                        else None
                    ),
                    "height_cm": (
                        float(latest_metric.height_cm)
                        if latest_metric and latest_metric.height_cm
                        else None
                    ),
                    "measured_at": (
                        str(latest_metric.measured_at)
                        if latest_metric
                        else None
                    ),
                },
                "meals": meals_summary,
                "workout_sessions": sessions_summary,
            }
        )


# ============================================================================
# WELLNESS CENTER VIEWS
# ============================================================================

from django.db.models import Avg  # noqa: E402

from personal_planning.models import (  # noqa: E402
    CrisisImpulseLog,
    EmotionalCheckin,
    SelfEsteemAssessment,
    WellnessIntervention,
    WellnessInterventionCompletion,
    WellnessWeeklyReport,
)
from personal_planning.serializers import (  # noqa: E402
    CrisisImpulseLogCreateSerializer,
    CrisisImpulseLogSerializer,
    EmotionalCheckinCreateSerializer,
    EmotionalCheckinSerializer,
    SelfEsteemAssessmentCreateSerializer,
    SelfEsteemAssessmentSerializer,
    WellnessInterventionCompletionCreateSerializer,
    WellnessInterventionCompletionSerializer,
    WellnessInterventionSerializer,
    WellnessWeeklyReportSerializer,
)


def _get_member(user):
    from members.models import Member

    return Member.objects.get(user=user)


class SelfEsteemAssessmentListCreateView(BaseListCreateView):
    serializer_class = SelfEsteemAssessmentSerializer

    def get_queryset(self):
        member = _get_member(self.request.user)
        return SelfEsteemAssessment.objects.filter(
            owner=member, is_deleted=False
        )

    def perform_create(self, serializer):
        member = _get_member(self.request.user)
        serializer.save(owner=member)

    def create(self, request, *args, **kwargs):
        create_ser = SelfEsteemAssessmentCreateSerializer(
            data={**request.data, "owner": _get_member(request.user).pk}
        )
        create_ser.is_valid(raise_exception=True)
        instance = create_ser.save()

        # Gera análise da IA de forma assíncrona/best-effort
        try:
            _generate_self_esteem_ai(request.user, instance)
        except Exception:
            pass

        out = SelfEsteemAssessmentSerializer(instance)
        return Response(out.data, status=status.HTTP_201_CREATED)


class SelfEsteemAssessmentDetailView(BaseRetrieveUpdateDestroyView):
    serializer_class = SelfEsteemAssessmentSerializer

    def get_queryset(self):
        member = _get_member(self.request.user)
        return SelfEsteemAssessment.objects.filter(
            owner=member, is_deleted=False
        )


def _generate_self_esteem_ai(user, instance: SelfEsteemAssessment):
    """Chama o LLM e salva a análise no registro."""
    from agents.core.llm_client import LLMClient

    member = _get_member(user)
    recent = SelfEsteemAssessment.objects.filter(
        owner=member, is_deleted=False
    ).order_by("-assessed_at")[:5]
    history_str = ", ".join(f"{a.assessed_at}: {a.score}/30" for a in recent)

    questions = [
        "Sinto que sou uma pessoa de valor, pelo menos tanto quanto"
        " outras pessoas.",
        "Sinto que tenho várias qualidades boas.",
        "Ao todo, estou inclinado(a) a sentir que sou um(a)" " fracasso(a).",
        "Sou capaz de fazer as coisas tão bem quanto outras pessoas.",
        "Sinto que não tenho muito do que me orgulhar.",
        "Tenho uma atitude positiva em relação a mim mesmo(a).",
        "No geral, estou satisfeito(a) comigo mesmo(a).",
        "Gostaria de poder ter mais respeito por mim mesmo(a).",
        "Às vezes me sinto inútil(mente).",
        "Às vezes penso que não sirvo para nada.",
    ]
    respostas_str = "\n".join(
        f"Q{i+1}: {q} → {v}/3"
        for i, (q, v) in enumerate(
            zip(
                questions,
                [
                    instance.q1,
                    instance.q2,
                    instance.q3,
                    instance.q4,
                    instance.q5,
                    instance.q6,
                    instance.q7,
                    instance.q8,
                    instance.q9,
                    instance.q10,
                ],
            )
        )
    )

    _json_schema = (
        "{{\n"
        '  "analysis": "Análise empática em 2-3 parágrafos.'
        ' NÃO use linguagem clínica ou diagnóstica.",\n'
        '  "strengths": ["ponto forte 1", "ponto forte 2",'
        ' "ponto forte 3"],\n'
        '  "limiting_beliefs": ["crença limitante 1",'
        ' "crença limitante 2"],\n'
        '  "weekly_suggestions": ["sugestão prática 1",'
        ' "sugestão prática 2", "sugestão prática 3"]\n'
        "}}"
    )
    prompt = (
        "Você é um coach de desenvolvimento pessoal empático e prático.\n"
        "O usuário completou a Escala de Autoestima de Rosenberg.\n\n"
        f"Pontuação atual: {instance.score}/30\n"
        f"Histórico recente: {history_str or 'primeira avaliação'}\n\n"
        f"Respostas:\n{respostas_str}\n\n"
        "Responda SOMENTE com JSON válido (sem markdown) neste formato:\n"
        f"{_json_schema}\n\n"
        "Fale na segunda pessoa, de forma calorosa, nunca diagnóstica."
    )

    resp = LLMClient.chat([{"role": "user", "content": prompt}])
    start, end = resp.find("{"), resp.rfind("}") + 1
    if start != -1 and end > start:
        instance.ai_analysis = resp[start:end]
        SelfEsteemAssessment.objects.filter(pk=instance.pk).update(
            ai_analysis=instance.ai_analysis
        )


class EmotionalCheckinListCreateView(BaseListCreateView):
    serializer_class = EmotionalCheckinSerializer

    def get_queryset(self):
        member = _get_member(self.request.user)
        qs = EmotionalCheckin.objects.filter(owner=member, is_deleted=False)
        days = self.request.query_params.get("days")
        if days:
            try:
                cutoff = date.today() - timedelta(days=int(days))
                qs = qs.filter(checked_at__gte=cutoff)
            except ValueError:
                pass
        return qs

    def create(self, request, *args, **kwargs):
        create_ser = EmotionalCheckinCreateSerializer(
            data={**request.data, "owner": _get_member(request.user).pk}
        )
        create_ser.is_valid(raise_exception=True)
        instance = create_ser.save()
        out = EmotionalCheckinSerializer(instance)
        return Response(out.data, status=status.HTTP_201_CREATED)


class EmotionalCheckinDetailView(BaseRetrieveUpdateDestroyView):
    serializer_class = EmotionalCheckinSerializer

    def get_queryset(self):
        member = _get_member(self.request.user)
        return EmotionalCheckin.objects.filter(owner=member, is_deleted=False)


class CrisisImpulseLogListCreateView(BaseListCreateView):
    serializer_class = CrisisImpulseLogSerializer

    def get_queryset(self):
        member = _get_member(self.request.user)
        return CrisisImpulseLog.objects.filter(owner=member, is_deleted=False)

    def create(self, request, *args, **kwargs):
        member = _get_member(request.user)
        create_ser = CrisisImpulseLogCreateSerializer(
            data={**request.data, "owner": member.pk}
        )
        create_ser.is_valid(raise_exception=True)
        instance = create_ser.save()

        # Gera resposta da IA
        try:
            _generate_crisis_ai(instance)
        except Exception:
            pass

        out = CrisisImpulseLogSerializer(instance)
        return Response(out.data, status=status.HTTP_201_CREATED)


class CrisisImpulseLogDetailView(BaseRetrieveUpdateDestroyView):
    serializer_class = CrisisImpulseLogSerializer

    def get_queryset(self):
        member = _get_member(self.request.user)
        return CrisisImpulseLog.objects.filter(owner=member, is_deleted=False)


def _generate_crisis_ai(instance: CrisisImpulseLog):
    """Gera resposta empática + plano de ação imediato via LLM."""
    from agents.core.llm_client import LLMClient

    emotional_label = instance.get_emotional_state_display()
    impulse_label = instance.get_impulse_type_display()
    if instance.emotional_state == "other" and instance.emotional_state_other:
        emotional_label = instance.emotional_state_other
    if instance.impulse_type == "other" and instance.impulse_type_other:
        impulse_label = instance.impulse_type_other

    _crisis_schema = (
        "{{\n"
        '  "validation": "Validação emocional calorosa em 2-3 frases.'
        ' SEM julgamento. SEM diagnóstico.",\n'
        '  "explanation": "Explicação curta (1-2 frases) de por que'
        ' o impulso pode estar surgindo agora.",\n'
        '  "action_plan": {{\n'
        '    "5min": ["ação 1 de 5 minutos", "ação 2 de 5 minutos"],\n'
        '    "10min": ["ação 1 de 10 min", "ação 2 de 10 min"],\n'
        '    "20min": ["ação 1 de 20 min", "ação 2 de 20 min"]\n'
        "  }},\n"
        '  "affirmation": "Uma frase de encorajamento curta e genuína."\n'
        "}}"
    )
    prompt = (
        "Você é um coach de bem-estar emocional empático e sem"
        " julgamentos.\n"
        "O usuário está passando por um momento difícil e pediu ajuda.\n\n"
        f"Estado emocional: {emotional_label}\n"
        f"Impulso que está tentando evitar: {impulse_label}\n\n"
        "Responda SOMENTE com JSON válido (sem markdown) neste formato:\n"
        f"{_crisis_schema}\n\n"
        "Seja extremamente prático e humano. Nunca use linguagem clínica."
    )

    resp = LLMClient.chat([{"role": "user", "content": prompt}])
    start, end = resp.find("{"), resp.rfind("}") + 1
    if start != -1 and end > start:
        CrisisImpulseLog.objects.filter(pk=instance.pk).update(
            ai_response=resp[start:end]
        )
        instance.ai_response = resp[start:end]


class WellnessInterventionListView(BaseListCreateView):
    serializer_class = WellnessInterventionSerializer
    http_method_names = ["get"]

    def get_queryset(self):
        member = _get_member(self.request.user)
        from django.db.models import Q

        qs = WellnessIntervention.objects.filter(is_deleted=False).filter(
            Q(is_global=True) | Q(owner=member)
        )
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        duration = self.request.query_params.get("max_duration")
        if duration:
            try:
                qs = qs.filter(duration_minutes__lte=int(duration))
            except ValueError:
                pass
        return qs


class WellnessInterventionCompletionListCreateView(BaseListCreateView):
    serializer_class = WellnessInterventionCompletionSerializer

    def get_queryset(self):
        member = _get_member(self.request.user)
        return WellnessInterventionCompletion.objects.filter(
            owner=member, is_deleted=False
        ).select_related("intervention")

    def create(self, request, *args, **kwargs):
        create_ser = WellnessInterventionCompletionCreateSerializer(
            data={**request.data, "owner": _get_member(request.user).pk}
        )
        create_ser.is_valid(raise_exception=True)
        instance = create_ser.save()
        out = WellnessInterventionCompletionSerializer(instance)
        return Response(out.data, status=status.HTTP_201_CREATED)


class WellnessInterventionCompletionDetailView(BaseRetrieveUpdateDestroyView):
    serializer_class = WellnessInterventionCompletionSerializer

    def get_queryset(self):
        member = _get_member(self.request.user)
        return WellnessInterventionCompletion.objects.filter(
            owner=member, is_deleted=False
        )


class WellnessWeeklyReportListView(BaseListCreateView):
    serializer_class = WellnessWeeklyReportSerializer
    http_method_names = ["get"]

    def get_queryset(self):
        member = _get_member(self.request.user)
        return WellnessWeeklyReport.objects.filter(
            owner=member, is_deleted=False
        )


class WellnessWeeklyReportGenerateView(APIView):
    """POST /wellness/weekly-report/generate/ — relatório via IA."""

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        import json as _json

        from agents.core.llm_client import LLMClient

        member = _get_member(request.user)
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)

        checkins = EmotionalCheckin.objects.filter(
            owner=member,
            is_deleted=False,
            checked_at__range=(week_start, week_end),
        )
        assessments = SelfEsteemAssessment.objects.filter(
            owner=member, is_deleted=False
        ).order_by("-assessed_at")
        impulses = CrisisImpulseLog.objects.filter(
            owner=member,
            is_deleted=False,
            logged_at__date__range=(week_start, week_end),
        )
        completions = WellnessInterventionCompletion.objects.filter(
            owner=member,
            is_deleted=False,
            completed_at__date__range=(week_start, week_end),
        ).select_related("intervention")

        agg = checkins.aggregate(
            avg_l=Avg("loneliness"),
            avg_a=Avg("anxiety"),
            avg_m=Avg("motivation"),
        )
        latest_score = (
            assessments.first().score if assessments.exists() else None
        )
        completed_titles = ", ".join(
            c.intervention.title for c in completions[:10]
        )

        n_completions = completions.count()
        context = (
            f"Semana: {week_start} a {week_end}\n"
            f"Check-ins realizados: {checkins.count()}\n"
            f"Média solidão: {agg['avg_l'] or 'N/A'}\n"
            f"Média ansiedade: {agg['avg_a'] or 'N/A'}\n"
            f"Média motivação: {agg['avg_m'] or 'N/A'}\n"
            f"Impulsos registrados: {impulses.count()}\n"
            f"Intervenções concluídas: {n_completions}"
            f" ({completed_titles})\n"
            f"Última pontuação Rosenberg:"
            f" {latest_score or 'sem avaliação'}/30\n"
        )
        _weekly_schema = (
            "{{\n"
            '  "summary": "Resumo empático da semana em 2-3 parágrafos.'
            ' Sem linguagem alarmista. Sem diagnóstico.",\n'
            '  "attention_points": ["ponto de atenção 1",'
            ' "ponto de atenção 2"],\n'
            '  "suggestions": ["sugestão prática 1",'
            ' "sugestão prática 2", "sugestão prática 3"]\n'
            "}}"
        )
        prompt = (
            "Você é um coach de bem-estar emocional.\n"
            "Analise os dados da semana do usuário e gere um relatório"
            " encorajador e prático.\n\n"
            f"{context}\n"
            "Responda SOMENTE com JSON válido (sem markdown):\n"
            f"{_weekly_schema}"
        )

        try:
            client = LLMClient
            resp = client.chat([{"role": "user", "content": prompt}])
            start, end = resp.find("{"), resp.rfind("}") + 1
            parsed = (
                _json.loads(resp[start:end])
                if start != -1 and end > start
                else {}
            )
        except Exception:
            parsed = {}

        report, _ = WellnessWeeklyReport.objects.update_or_create(
            owner=member,
            week_start=week_start,
            defaults={
                "week_end": week_end,
                "ai_summary": parsed.get("summary", ""),
                "attention_points": parsed.get("attention_points", []),
                "suggestions": parsed.get("suggestions", []),
                "avg_loneliness": agg["avg_l"],
                "avg_anxiety": agg["avg_a"],
                "avg_motivation": agg["avg_m"],
                "latest_self_esteem_score": latest_score,
            },
        )
        return Response(WellnessWeeklyReportSerializer(report).data)


class WellnessDashboardView(APIView):
    """GET /wellness/dashboard/ — dados agregados para o dashboard."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        member = _get_member(request.user)
        today = date.today()
        week_ago = today - timedelta(days=7)

        latest_assessment = SelfEsteemAssessment.objects.filter(
            owner=member, is_deleted=False
        ).first()
        week_assessments = SelfEsteemAssessment.objects.filter(
            owner=member, is_deleted=False, assessed_at__gte=week_ago
        )
        checkins_week = EmotionalCheckin.objects.filter(
            owner=member, is_deleted=False, checked_at__gte=week_ago
        )
        impulses_week = CrisisImpulseLog.objects.filter(
            owner=member,
            is_deleted=False,
            logged_at__date__gte=week_ago,
        )
        completions_week = WellnessInterventionCompletion.objects.filter(
            owner=member,
            is_deleted=False,
            completed_at__date__gte=week_ago,
        )

        agg = checkins_week.aggregate(
            avg_l=Avg("loneliness"),
            avg_a=Avg("anxiety"),
            avg_m=Avg("motivation"),
            avg_e=Avg("energy"),
        )
        week_score_avg = week_assessments.aggregate(avg=Avg("score"))["avg"]

        return Response(
            {
                "self_esteem": {
                    "current_score": (
                        latest_assessment.score if latest_assessment else None
                    ),
                    "assessed_at": (
                        str(latest_assessment.assessed_at)
                        if latest_assessment
                        else None
                    ),
                    "week_avg": (
                        round(float(week_score_avg), 1)
                        if week_score_avg
                        else None
                    ),
                },
                "emotional": {
                    "avg_loneliness": (
                        round(float(agg["avg_l"]), 1) if agg["avg_l"] else None
                    ),
                    "avg_anxiety": (
                        round(float(agg["avg_a"]), 1) if agg["avg_a"] else None
                    ),
                    "avg_motivation": (
                        round(float(agg["avg_m"]), 1) if agg["avg_m"] else None
                    ),
                    "avg_energy": (
                        round(float(agg["avg_e"]), 1) if agg["avg_e"] else None
                    ),
                    "checkins_this_week": checkins_week.count(),
                },
                "impulses": {
                    "count_this_week": impulses_week.count(),
                    "resolved_this_week": impulses_week.filter(
                        resolved=True
                    ).count(),
                },
                "interventions": {
                    "completed_this_week": completions_week.count(),
                },
            }
        )


class CrisisImpulseResolveView(APIView):
    """PATCH /wellness/crisis/<pk>/resolve/ — marca impulso como superado."""

    permission_classes = (IsAuthenticated,)

    def patch(self, request, pk):
        member = _get_member(request.user)
        try:
            log = CrisisImpulseLog.objects.get(
                pk=pk, owner=member, is_deleted=False
            )
        except CrisisImpulseLog.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        log.resolved = True
        log.save(update_fields=["resolved", "updated_at"])
        return Response(CrisisImpulseLogSerializer(log).data)
