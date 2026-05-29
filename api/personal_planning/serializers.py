from rest_framework import serializers

from personal_planning.models import (
    DailyReflection,
    Exercise,
    Food,
    Goal,
    MealLog,
    MealType,
    MenuOption,
    MenuOptionIngredient,
    RoutineTask,
    TaskInstance,
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
        ]

    def validate(self, data):
        """Validacao customizada."""
        instance = RoutineTask(**data)
        instance.clean()
        return data


# ============================================================================
# GOAL SERIALIZERS
# ============================================================================


class GoalSerializer(serializers.ModelSerializer):
    """Serializer para visualizacao de objetivos."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    goal_type_display = serializers.CharField(
        source="get_goal_type_display", read_only=True
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

    class Meta:
        model = Goal
        fields = [
            "id",
            "uuid",
            "title",
            "description",
            "goal_type",
            "goal_type_display",
            "related_task",
            "related_task_name",
            "target_value",
            "current_value",
            "calculated_current_value",
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


class InstancesForDateResponseSerializer(serializers.Serializer):
    """Serializer para resposta do endpoint instances-for-date."""

    date = serializers.DateField()
    instances = TaskInstanceSerializer(many=True)
    summary = serializers.DictField()


# ============================================================================
# WORKOUT SERIALIZERS
# ============================================================================


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = [
            "id",
            "uuid",
            "name",
            "muscle_groups",
            "description",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class ExerciseCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = ["id", "name", "muscle_groups", "description", "owner"]


class WorkoutExerciseSerializer(serializers.ModelSerializer):
    load_unit_display = serializers.CharField(
        source="get_load_unit_display", read_only=True, default=None
    )
    exercise_catalog_name = serializers.CharField(
        source="exercise.name", read_only=True, default=None
    )

    class Meta:
        model = WorkoutExercise
        fields = [
            "id",
            "uuid",
            "workout_day",
            "exercise",
            "exercise_catalog_name",
            "name",
            "sets",
            "reps_min",
            "reps_max",
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
            "order",
            "exercises",
            "exercise_count",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_exercise_count(self, obj):
        return obj.exercises.filter(deleted_at__isnull=True).count()


class WorkoutDayCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutDay
        fields = ["id", "plan", "name", "muscle_groups", "order", "owner"]


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
        return obj.days.filter(deleted_at__isnull=True).count()

    def get_exercise_count(self, obj):
        return WorkoutExercise.objects.filter(
            workout_day__plan=obj, deleted_at__isnull=True
        ).count()


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

    class Meta:
        model = WorkoutSessionExercise
        fields = [
            "id",
            "uuid",
            "session",
            "exercise",
            "exercise_name",
            "sets_target",
            "reps_target_min",
            "reps_target_max",
            "order",
            "sets",
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


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
            "owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class FoodCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Food
        fields = ["id", "name", "description", "owner"]


class MenuOptionIngredientSerializer(serializers.ModelSerializer):
    food_name = serializers.CharField(source="food.name", read_only=True)
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
            "quantity",
            "unit",
            "unit_display",
            "is_optional",
            "notes",
            "order",
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
