from rest_framework import serializers

from personal_planning.models import (
    BodyMetric,
    Challenge,
    DailyReflection,
    Exercise,
    ExerciseDatasetEntry,
    Food,
    Goal,
    GoalFailure,
    MealLog,
    MealType,
    MenuOption,
    MenuOptionIngredient,
    RoutineTask,
    TaskInstance,
    UserRoutineTemplate,
    WorkoutDay,
    WorkoutExercise,
    WorkoutPlan,
    WorkoutSession,
    WorkoutSessionExercise,
    WorkoutSessionSet,
)

# ============================================================================
# ROUTINE TASK SERIALIZERS
# ============================================================================


class RoutineTaskSerializer(serializers.ModelSerializer):
    """Serializer para visualizacao de tarefas rotineiras."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    periodicity_display = serializers.CharField(
        source="get_periodicity_display", read_only=True
    )
    weekday_display = serializers.CharField(
        source="get_weekday_display", read_only=True
    )
    priority_display = serializers.CharField(
        source="get_priority_display", read_only=True
    )
    unit_display = serializers.CharField(
        source="get_unit_display", read_only=True
    )
    completion_rate = serializers.SerializerMethodField()
    total_completions = serializers.SerializerMethodField()
    linked_financial_goal_description = serializers.CharField(
        source="linked_financial_goal.description",
        read_only=True,
        default=None,
    )
    linked_book_title = serializers.CharField(
        source="linked_book.title", read_only=True, default=None
    )

    class Meta:
        model = RoutineTask
        fields = [
            "id",
            "uuid",
            "name",
            "description",
            "category",
            "category_display",
            "icon",
            "periodicity",
            "periodicity_display",
            "weekday",
            "weekday_display",
            "day_of_month",
            "is_active",
            "priority",
            "priority_display",
            "allowed_skips_per_month",
            "target_quantity",
            "unit",
            "unit_display",
            "custom_weekdays",
            "custom_month_days",
            "times_per_week",
            "times_per_month",
            "interval_days",
            "interval_start_date",
            "default_time",
            "closing_time",
            "daily_occurrences",
            "interval_hours",
            "scheduled_times",
            "completion_rate",
            "total_completions",
            "linked_financial_goal",
            "linked_financial_goal_description",
            "linked_book",
            "linked_book_title",
            "chained_task",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_completion_rate(self, obj):
        """Calcula taxa de cumprimento nos ultimos 30 dias."""
        from datetime import timedelta

        from django.utils import timezone

        thirty_days_ago = timezone.now().date() - timedelta(days=30)
        instances = obj.instances.filter(
            scheduled_date__gte=thirty_days_ago, deleted_at__isnull=True
        )

        if instances.count() == 0:
            return 0.0

        completed = instances.filter(status="completed").count()
        return round((completed / instances.count()) * 100, 1)

    def get_total_completions(self, obj):
        """Conta total de vezes que a tarefa foi cumprida."""
        return obj.instances.filter(
            status="completed", deleted_at__isnull=True
        ).count()


class RoutineTaskCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criacao/atualizacao de tarefas rotineiras."""

    class Meta:
        model = RoutineTask
        fields = [
            "id",
            "name",
            "description",
            "category",
            "icon",
            "periodicity",
            "weekday",
            "day_of_month",
            "is_active",
            "priority",
            "allowed_skips_per_month",
            "target_quantity",
            "unit",
            "owner",
            "custom_weekdays",
            "custom_month_days",
            "times_per_week",
            "times_per_month",
            "interval_days",
            "interval_start_date",
            "default_time",
            "closing_time",
            "daily_occurrences",
            "interval_hours",
            "scheduled_times",
            "linked_financial_goal",
            "linked_book",
            "chained_task",
        ]

    def validate(self, data):
        """Validacao customizada."""
        instance = RoutineTask(**data)
        instance.clean()
        return data


# ============================================================================
# GOAL SERIALIZERS
# ============================================================================


class GoalFailureSerializer(serializers.ModelSerializer):
    """Serializer para o historico de falhas de um objetivo."""

    class Meta:
        model = GoalFailure
        fields = ["id", "failure_date", "streak_at_failure", "created_at"]
        read_only_fields = fields


class GoalSerializer(serializers.ModelSerializer):
    """Serializer para visualizacao de objetivos."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    goal_type_display = serializers.CharField(
        source="get_goal_type_display", read_only=True
    )
    goal_source_display = serializers.CharField(
        source="get_goal_source_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    related_task_name = serializers.CharField(
        source="related_task.name", read_only=True
    )
    progress_percentage = serializers.ReadOnlyField()
    days_active = serializers.ReadOnlyField()
    calculated_current_value = serializers.ReadOnlyField()
    best_streak = serializers.ReadOnlyField()
    failures = GoalFailureSerializer(many=True, read_only=True)

    class Meta:
        model = Goal
        fields = [
            "id",
            "uuid",
            "title",
            "description",
            "goal_type",
            "goal_type_display",
            "goal_source",
            "goal_source_display",
            "related_task",
            "related_task_name",
            "target_value",
            "current_value",
            "calculated_current_value",
            "best_streak",
            "failures",
            "start_date",
            "end_date",
            "status",
            "status_display",
            "progress_percentage",
            "days_active",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class GoalCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criacao/atualizacao de objetivos."""

    end_date = serializers.DateField(required=False, allow_null=True)

    def to_internal_value(self, data):
        # Normaliza string vazia para null antes da validacao do campo
        if data.get("end_date") == "":
            data = {**data, "end_date": None}
        return super().to_internal_value(data)

    class Meta:
        model = Goal
        fields = [
            "id",
            "title",
            "description",
            "goal_type",
            "goal_source",
            "related_task",
            "target_value",
            "current_value",
            "start_date",
            "end_date",
            "status",
            "owner",
        ]


# ============================================================================
# DAILY REFLECTION SERIALIZERS
# ============================================================================


class DailyReflectionSerializer(serializers.ModelSerializer):
    """Serializer para visualizacao de reflexoes diarias."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    mood_display = serializers.CharField(
        source="get_mood_display", read_only=True
    )

    class Meta:
        model = DailyReflection
        fields = [
            "id",
            "uuid",
            "date",
            "reflection",
            "mood",
            "mood_display",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class DailyReflectionCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criacao/atualizacao de reflexoes diarias."""

    class Meta:
        model = DailyReflection
        fields = ["id", "date", "reflection", "mood", "owner"]


# ============================================================================
# TASK INSTANCE SERIALIZERS
# ============================================================================


class TaskInstanceSerializer(serializers.ModelSerializer):
    """Serializer para visualizacao de instancias de tarefas."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    template_name = serializers.CharField(
        source="template.name", read_only=True
    )
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    time_display = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()

    priority_display = serializers.SerializerMethodField()
    closing_time = serializers.SerializerMethodField()

    def get_priority_display(self, obj):
        from personal_planning.models import PRIORITY_CHOICES

        return dict(PRIORITY_CHOICES).get(obj.priority, obj.priority)

    def get_closing_time(self, obj):
        if obj.template and obj.template.daily_occurrences == 1:
            ct = obj.template.closing_time
            return str(ct) if ct else None
        return None

    class Meta:
        model = TaskInstance
        fields = [
            "id",
            "uuid",
            "template",
            "template_name",
            "task_name",
            "task_description",
            "category",
            "category_display",
            "icon",
            "priority",
            "priority_display",
            "scheduled_date",
            "scheduled_time",
            "time_display",
            "occurrence_index",
            "status",
            "status_display",
            "target_quantity",
            "quantity_completed",
            "unit",
            "notes",
            "started_at",
            "completed_at",
            "is_overdue",
            "closing_time",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class TaskInstanceCreateSerializer(serializers.ModelSerializer):
    """Serializer para criacao de instancias avulsas (one-off tasks)."""

    class Meta:
        model = TaskInstance
        fields = [
            "task_name",
            "task_description",
            "category",
            "icon",
            "scheduled_date",
            "scheduled_time",
            "target_quantity",
            "unit",
            "owner",
        ]

    def create(self, validated_data):
        """Cria instancia avulsa com valores padrao."""
        validated_data.setdefault("status", "pending")
        validated_data.setdefault("occurrence_index", 0)
        validated_data.setdefault("quantity_completed", 0)
        return super().create(validated_data)


class TaskInstanceUpdateSerializer(serializers.ModelSerializer):
    """Serializer para atualizacao de instancias."""

    class Meta:
        model = TaskInstance
        fields = ["status", "quantity_completed", "notes"]


class TaskInstanceStatusUpdateSerializer(serializers.Serializer):
    """Serializer para atualizacao rapida de status."""

    status = serializers.ChoiceField(
        choices=["pending", "in_progress", "completed", "skipped", "cancelled"]
    )
    notes = serializers.CharField(required=False, allow_blank=True)


# ============================================================================
# WORKOUT SERIALIZERS
# ============================================================================


class ExerciseDatasetEntrySerializer(serializers.ModelSerializer):
    """Somente leitura — resultados de busca no picker de imagens de
    exercícios. Mídia servida via proxy de stream (evita expor URLs
    diretas/credenciais do MinIO)."""

    thumbnail_url = serializers.SerializerMethodField()
    gif_url = serializers.SerializerMethodField()

    class Meta:
        model = ExerciseDatasetEntry
        fields = [
            "id",
            "dataset_id",
            "name",
            "category",
            "body_part",
            "equipment",
            "target",
            "muscle_group",
            "thumbnail_url",
            "gif_url",
        ]

    def get_thumbnail_url(self, obj):
        if not obj.thumbnail:
            return None
        return (
            f"/api/v1/personal-planning/exercise-dataset/{obj.pk}/thumbnail/"
        )

    def get_gif_url(self, obj):
        if not obj.gif:
            return None
        return f"/api/v1/personal-planning/exercise-dataset/{obj.pk}/gif/"


class ExerciseSerializer(serializers.ModelSerializer):
    dataset_entry_name = serializers.CharField(
        source="dataset_entry.name", read_only=True, default=None
    )
    gif_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Exercise
        fields = [
            "id",
            "uuid",
            "name",
            "muscle_groups",
            "description",
            "dataset_entry",
            "dataset_entry_name",
            "gif_url",
            "thumbnail_url",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_gif_url(self, obj):
        if not obj.dataset_entry or not obj.dataset_entry.gif:
            return None
        return f"/api/v1/personal-planning/exercises/{obj.pk}/gif/"

    def get_thumbnail_url(self, obj):
        if not obj.dataset_entry or not obj.dataset_entry.thumbnail:
            return None
        return f"/api/v1/personal-planning/exercises/{obj.pk}/thumbnail/"


class ExerciseCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = [
            "id",
            "name",
            "muscle_groups",
            "description",
            "dataset_entry",
            "owner",
        ]


class WorkoutExerciseSerializer(serializers.ModelSerializer):
    load_unit_display = serializers.CharField(
        source="get_load_unit_display", read_only=True, default=None
    )
    exercise_catalog_name = serializers.CharField(
        source="exercise.name", read_only=True, default=None
    )
    gif_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutExercise
        fields = [
            "id",
            "uuid",
            "workout_day",
            "exercise",
            "exercise_catalog_name",
            "gif_url",
            "thumbnail_url",
            "name",
            "sets",
            "reps_min",
            "reps_max",
            "rest_seconds",
            "load",
            "load_unit",
            "load_unit_display",
            "order",
            "notes",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_gif_url(self, obj):
        catalog = obj.exercise
        if (
            not catalog
            or not catalog.dataset_entry
            or not catalog.dataset_entry.gif
        ):
            return None
        return f"/api/v1/personal-planning/exercises/{catalog.pk}/gif/"

    def get_thumbnail_url(self, obj):
        catalog = obj.exercise
        if (
            not catalog
            or not catalog.dataset_entry
            or not catalog.dataset_entry.thumbnail
        ):
            return None
        return f"/api/v1/personal-planning/exercises/{catalog.pk}/thumbnail/"


class WorkoutExerciseCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutExercise
        fields = [
            "id",
            "workout_day",
            "exercise",
            "name",
            "sets",
            "reps_min",
            "reps_max",
            "rest_seconds",
            "load",
            "load_unit",
            "order",
            "notes",
            "owner",
        ]


class WorkoutDaySerializer(serializers.ModelSerializer):
    exercises = WorkoutExerciseSerializer(many=True, read_only=True)
    exercise_count = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutDay
        fields = [
            "id",
            "uuid",
            "plan",
            "name",
            "muscle_groups",
            "day_of_week",
            "order",
            "default_start_time",
            "default_duration_minutes",
            "exercises",
            "exercise_count",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_exercise_count(self, obj):
        # `exercises` já vem filtrado por soft-delete via Prefetch na view;
        # `.all()` reaproveita o cache do prefetch em vez de nova query.
        return len(obj.exercises.all())


class WorkoutDayCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutDay
        fields = [
            "id",
            "plan",
            "name",
            "muscle_groups",
            "day_of_week",
            "order",
            "default_start_time",
            "default_duration_minutes",
            "owner",
        ]


class WorkoutPlanSerializer(serializers.ModelSerializer):
    days = WorkoutDaySerializer(many=True, read_only=True)
    day_count = serializers.SerializerMethodField()
    exercise_count = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutPlan
        fields = [
            "id",
            "uuid",
            "name",
            "description",
            "is_active",
            "days",
            "day_count",
            "exercise_count",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_day_count(self, obj):
        # `days` (e `days.exercises`) já vêm filtrados por soft-delete via
        # Prefetch na view; `.all()` reaproveita o cache do prefetch.
        return len(obj.days.all())

    def get_exercise_count(self, obj):
        return sum(len(day.exercises.all()) for day in obj.days.all())


class WorkoutPlanCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutPlan
        fields = ["id", "name", "description", "is_active", "owner"]


class WorkoutSessionSetSerializer(serializers.ModelSerializer):
    load_unit_display = serializers.CharField(
        source="get_load_unit_display", read_only=True
    )

    class Meta:
        model = WorkoutSessionSet
        fields = [
            "id",
            "uuid",
            "session_exercise",
            "set_number",
            "load",
            "load_unit",
            "load_unit_display",
            "reps_done",
            "completed",
            "notes",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class WorkoutSessionSetCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutSessionSet
        fields = [
            "id",
            "session_exercise",
            "set_number",
            "load",
            "load_unit",
            "reps_done",
            "completed",
            "notes",
            "owner",
        ]


class WorkoutSessionExerciseSerializer(serializers.ModelSerializer):
    sets = WorkoutSessionSetSerializer(many=True, read_only=True)
    gif_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutSessionExercise
        fields = [
            "id",
            "uuid",
            "session",
            "exercise",
            "exercise_name",
            "gif_url",
            "thumbnail_url",
            "sets_target",
            "reps_target_min",
            "reps_target_max",
            "load_target",
            "load_target_unit",
            "order",
            "sets",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def _catalog_exercise(self, obj):
        plan_exercise = obj.exercise
        if not plan_exercise:
            return None
        return plan_exercise.exercise

    def get_gif_url(self, obj):
        catalog = self._catalog_exercise(obj)
        if (
            not catalog
            or not catalog.dataset_entry
            or not catalog.dataset_entry.gif
        ):
            return None
        return f"/api/v1/personal-planning/exercises/{catalog.pk}/gif/"

    def get_thumbnail_url(self, obj):
        catalog = self._catalog_exercise(obj)
        if (
            not catalog
            or not catalog.dataset_entry
            or not catalog.dataset_entry.thumbnail
        ):
            return None
        return f"/api/v1/personal-planning/exercises/{catalog.pk}/thumbnail/"


class WorkoutSessionExerciseCreateUpdateSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = WorkoutSessionExercise
        fields = [
            "id",
            "session",
            "exercise",
            "exercise_name",
            "sets_target",
            "reps_target_min",
            "reps_target_max",
            "load_target",
            "load_target_unit",
            "order",
            "owner",
        ]


class WorkoutSessionSerializer(serializers.ModelSerializer):
    workout_day_name = serializers.CharField(
        source="workout_day.name", read_only=True, default=None
    )
    workout_day_muscle_groups = serializers.CharField(
        source="workout_day.muscle_groups", read_only=True, default=None
    )
    duration_minutes = serializers.IntegerField(read_only=True)
    session_exercises = WorkoutSessionExerciseSerializer(
        many=True, read_only=True
    )

    class Meta:
        model = WorkoutSession
        fields = [
            "id",
            "uuid",
            "workout_day",
            "workout_day_name",
            "workout_day_muscle_groups",
            "date",
            "started_at",
            "finished_at",
            "duration_minutes",
            "notes",
            "session_exercises",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class WorkoutSessionCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutSession
        fields = [
            "id",
            "workout_day",
            "date",
            "started_at",
            "finished_at",
            "notes",
            "owner",
        ]


# ============================================================================
# NUTRITION SERIALIZERS
# ============================================================================


class FoodSerializer(serializers.ModelSerializer):
    class Meta:
        model = Food
        fields = [
            "id",
            "uuid",
            "name",
            "description",
            "calories_per_serving",
            "serving_size",
            "serving_unit",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class FoodCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Food
        fields = [
            "id",
            "name",
            "description",
            "calories_per_serving",
            "serving_size",
            "serving_unit",
            "owner",
        ]


class MenuOptionIngredientSerializer(serializers.ModelSerializer):
    food_name = serializers.CharField(source="food.name", read_only=True)
    food_calories_per_serving = serializers.DecimalField(
        source="food.calories_per_serving",
        read_only=True,
        max_digits=8,
        decimal_places=2,
        default=None,
    )
    food_serving_size = serializers.DecimalField(
        source="food.serving_size",
        read_only=True,
        max_digits=8,
        decimal_places=2,
        default=None,
    )
    food_serving_unit = serializers.CharField(
        source="food.serving_unit", read_only=True, default=None
    )
    unit_display = serializers.CharField(
        source="get_unit_display", read_only=True
    )

    class Meta:
        model = MenuOptionIngredient
        fields = [
            "id",
            "uuid",
            "menu_option",
            "food",
            "food_name",
            "food_calories_per_serving",
            "food_serving_size",
            "food_serving_unit",
            "quantity",
            "unit",
            "unit_display",
            "is_optional",
            "notes",
            "order",
            "alternative_group",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class MenuOptionIngredientCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuOptionIngredient
        fields = [
            "id",
            "menu_option",
            "food",
            "quantity",
            "unit",
            "is_optional",
            "notes",
            "order",
            "alternative_group",
            "owner",
        ]


class MenuOptionSerializer(serializers.ModelSerializer):
    ingredients = MenuOptionIngredientSerializer(many=True, read_only=True)

    class Meta:
        model = MenuOption
        fields = [
            "id",
            "uuid",
            "meal_type",
            "name",
            "order",
            "ingredients",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class MenuOptionCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuOption
        fields = ["id", "meal_type", "name", "order", "owner"]


class MealTypeSerializer(serializers.ModelSerializer):
    options = MenuOptionSerializer(many=True, read_only=True)

    class Meta:
        model = MealType
        fields = [
            "id",
            "uuid",
            "name",
            "suggested_time",
            "order",
            "is_active",
            "options",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class MealTypeCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealType
        fields = [
            "id",
            "name",
            "suggested_time",
            "order",
            "is_active",
            "owner",
        ]


class MealLogSerializer(serializers.ModelSerializer):
    meal_type_name = serializers.CharField(
        source="meal_type.name", read_only=True
    )
    meal_type_suggested_time = serializers.TimeField(
        source="meal_type.suggested_time", read_only=True
    )
    menu_option_name = serializers.CharField(
        source="menu_option.name", read_only=True, default=None
    )

    class Meta:
        model = MealLog
        fields = [
            "id",
            "uuid",
            "meal_type",
            "meal_type_name",
            "meal_type_suggested_time",
            "menu_option",
            "menu_option_name",
            "is_free_meal",
            "date",
            "time",
            "notes",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class MealLogCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealLog
        fields = [
            "id",
            "meal_type",
            "menu_option",
            "is_free_meal",
            "date",
            "time",
            "notes",
            "owner",
        ]


# ============================================================================
# USER ROUTINE TEMPLATE SERIALIZERS
# ============================================================================


class UserRoutineTemplateSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="owner.name", read_only=True)
    task_count = serializers.SerializerMethodField()

    class Meta:
        model = UserRoutineTemplate
        fields = [
            "id",
            "uuid",
            "name",
            "description",
            "icon",
            "tasks",
            "task_count",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_task_count(self, obj: UserRoutineTemplate) -> int:
        return len(obj.tasks) if isinstance(obj.tasks, list) else 0


# ============================================================================
# CHALLENGE SERIALIZERS
# ============================================================================


class ChallengeSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="owner.name", read_only=True)
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    days_elapsed = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = [
            "id",
            "uuid",
            "title",
            "description",
            "duration_days",
            "start_date",
            "end_date",
            "status",
            "status_display",
            "template_task",
            "completion_rate",
            "days_elapsed",
            "days_remaining",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_days_elapsed(self, obj) -> int:
        from django.utils import timezone

        today = timezone.now().date()
        if today < obj.start_date:
            return 0
        return min((today - obj.start_date).days + 1, obj.duration_days)

    def get_days_remaining(self, obj) -> int:
        from django.utils import timezone

        today = timezone.now().date()
        if today > obj.end_date:
            return 0
        return (obj.end_date - today).days


class ChallengeCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Challenge
        fields = [
            "id",
            "title",
            "description",
            "duration_days",
            "start_date",
            "end_date",
            "status",
            "template_task",
            "completion_rate",
            "owner",
        ]

    def validate(self, data):
        start = data.get("start_date")
        end = data.get("end_date")
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_date": "Data de fim deve ser posterior ao início."}
            )
        return data


# ============================================================================
# BODY METRIC SERIALIZERS
# ============================================================================


class BodyMetricSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="owner.name", read_only=True)

    class Meta:
        model = BodyMetric
        fields = [
            "id",
            "uuid",
            "measured_at",
            "weight_kg",
            "height_cm",
            "waist_cm",
            "neck_cm",
            "arm_cm",
            "hip_cm",
            "shoulders_cm",
            "chest_cm",
            "abdomen_cm",
            "arm_left_cm",
            "arm_right_cm",
            "thigh_left_cm",
            "thigh_right_cm",
            "calf_left_cm",
            "calf_right_cm",
            "skinfold_triceps_mm",
            "skinfold_subscapular_mm",
            "skinfold_suprailiac_mm",
            "skinfold_chest_mm",
            "skinfold_midaxillary_mm",
            "skinfold_abdominal_mm",
            "skinfold_thigh_mm",
            "body_fat_method",
            "body_fat_pct",
            "notes",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class BodyMetricCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BodyMetric
        fields = [
            "id",
            "measured_at",
            "weight_kg",
            "height_cm",
            "waist_cm",
            "neck_cm",
            "arm_cm",
            "hip_cm",
            "shoulders_cm",
            "chest_cm",
            "abdomen_cm",
            "arm_left_cm",
            "arm_right_cm",
            "thigh_left_cm",
            "thigh_right_cm",
            "calf_left_cm",
            "calf_right_cm",
            "skinfold_triceps_mm",
            "skinfold_subscapular_mm",
            "skinfold_suprailiac_mm",
            "skinfold_chest_mm",
            "skinfold_midaxillary_mm",
            "skinfold_abdominal_mm",
            "skinfold_thigh_mm",
            "body_fat_method",
            "body_fat_pct",
            "notes",
            "owner",
        ]


class UserRoutineTemplateCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRoutineTemplate
        fields = ["id", "name", "description", "icon", "tasks", "owner"]


# ============================================================================
# WELLNESS CENTER SERIALIZERS
# ============================================================================

from personal_planning.models import (  # noqa: E402
    CrisisImpulseLog,
    EmotionalCheckin,
    SelfEsteemAssessment,
    WellnessIntervention,
    WellnessInterventionCompletion,
    WellnessWeeklyReport,
)


class SelfEsteemAssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SelfEsteemAssessment
        fields = [
            "id",
            "assessed_at",
            "q1",
            "q2",
            "q3",
            "q4",
            "q5",
            "q6",
            "q7",
            "q8",
            "q9",
            "q10",
            "score",
            "ai_analysis",
            "created_at",
        ]
        read_only_fields = ["score", "ai_analysis", "created_at"]


class SelfEsteemAssessmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SelfEsteemAssessment
        fields = [
            "assessed_at",
            "q1",
            "q2",
            "q3",
            "q4",
            "q5",
            "q6",
            "q7",
            "q8",
            "q9",
            "q10",
            "owner",
        ]


class EmotionalCheckinSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmotionalCheckin
        fields = [
            "id",
            "checked_at",
            "loneliness",
            "neediness",
            "anxiety",
            "sadness",
            "motivation",
            "energy",
            "what_happened",
            "occupying_thoughts",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class EmotionalCheckinCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmotionalCheckin
        fields = [
            "checked_at",
            "loneliness",
            "neediness",
            "anxiety",
            "sadness",
            "motivation",
            "energy",
            "what_happened",
            "occupying_thoughts",
            "owner",
        ]


class CrisisImpulseLogSerializer(serializers.ModelSerializer):
    emotional_state_display = serializers.CharField(
        source="get_emotional_state_display", read_only=True
    )
    impulse_type_display = serializers.CharField(
        source="get_impulse_type_display", read_only=True
    )

    class Meta:
        model = CrisisImpulseLog
        fields = [
            "id",
            "logged_at",
            "emotional_state",
            "emotional_state_display",
            "emotional_state_other",
            "impulse_type",
            "impulse_type_display",
            "impulse_type_other",
            "ai_response",
            "resolved",
            "created_at",
        ]
        read_only_fields = ["ai_response", "created_at"]


class CrisisImpulseLogCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrisisImpulseLog
        fields = [
            "logged_at",
            "emotional_state",
            "emotional_state_other",
            "impulse_type",
            "impulse_type_other",
            "owner",
        ]


class WellnessInterventionSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    difficulty_display = serializers.CharField(
        source="get_difficulty_display", read_only=True
    )

    class Meta:
        model = WellnessIntervention
        fields = [
            "id",
            "title",
            "description",
            "category",
            "category_display",
            "duration_minutes",
            "difficulty",
            "difficulty_display",
            "expected_benefit",
            "is_global",
        ]


class WellnessInterventionCompletionSerializer(serializers.ModelSerializer):
    intervention_title = serializers.CharField(
        source="intervention.title", read_only=True
    )
    intervention_category = serializers.CharField(
        source="intervention.category", read_only=True
    )

    class Meta:
        model = WellnessInterventionCompletion
        fields = [
            "id",
            "intervention",
            "intervention_title",
            "intervention_category",
            "completed_at",
            "rating",
            "notes",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class WellnessInterventionCompletionCreateSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = WellnessInterventionCompletion
        fields = ["intervention", "completed_at", "rating", "notes", "owner"]


class WellnessWeeklyReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = WellnessWeeklyReport
        fields = [
            "id",
            "week_start",
            "week_end",
            "ai_summary",
            "attention_points",
            "suggestions",
            "avg_loneliness",
            "avg_anxiety",
            "avg_motivation",
            "latest_self_esteem_score",
            "created_at",
        ]
        read_only_fields = ["created_at"]
