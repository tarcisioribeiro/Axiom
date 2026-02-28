from django.contrib import admin

from personal_planning.models import DailyReflection, Goal, RoutineTask, TaskInstance


@admin.register(RoutineTask)
class RoutineTaskAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "category", "periodicity", "is_active", "owner")
    list_filter = ("category", "periodicity", "is_active")
    search_fields = ("name", "description")


@admin.register(TaskInstance)
class TaskInstanceAdmin(admin.ModelAdmin):
    list_display = ("id", "task_name", "category", "scheduled_date", "status", "owner")
    list_filter = ("status", "category", "scheduled_date")
    search_fields = ("task_name", "notes")
    date_hierarchy = "scheduled_date"


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "goal_type",
        "status",
        "current_value",
        "target_value",
        "owner",
    )
    list_filter = ("goal_type", "status")
    search_fields = ("title", "description")


@admin.register(DailyReflection)
class DailyReflectionAdmin(admin.ModelAdmin):
    list_display = ("id", "date", "mood", "owner")
    list_filter = ("mood", "date")
    search_fields = ("reflection",)
