from rest_framework import serializers

from personal_planning.models import DailyReflection, Goal, RoutineTask, TaskInstance

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
    completion_rate = serializers.SerializerMethodField()
    total_completions = serializers.SerializerMethodField()

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
            "target_quantity",
            "unit",
            "custom_weekdays",
            "custom_month_days",
            "times_per_week",
            "times_per_month",
            "interval_days",
            "interval_start_date",
            "default_time",
            "daily_occurrences",
            "interval_hours",
            "scheduled_times",
            "completion_rate",
            "total_completions",
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
        return obj.instances.filter(status="completed", deleted_at__isnull=True).count()


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
            "daily_occurrences",
            "interval_hours",
            "scheduled_times",
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
    status_display = serializers.CharField(source="get_status_display", read_only=True)
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
    mood_display = serializers.CharField(source="get_mood_display", read_only=True)

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
    template_name = serializers.CharField(source="template.name", read_only=True)
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    time_display = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()

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
