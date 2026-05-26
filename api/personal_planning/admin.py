from django.contrib import admin

from personal_planning.models import (
    DailyReflection,
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


@admin.register(RoutineTask)
class RoutineTaskAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "category",
        "periodicity",
        "is_active",
        "owner",
    )
    list_filter = ("category", "periodicity", "is_active")
    search_fields = ("name", "description")


@admin.register(TaskInstance)
class TaskInstanceAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "task_name",
        "category",
        "scheduled_date",
        "status",
        "owner",
    )
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


@admin.register(WorkoutPlan)
class WorkoutPlanAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "is_active", "owner", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(WorkoutDay)
class WorkoutDayAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "muscle_groups", "plan", "order", "owner")
    list_filter = ("plan",)
    search_fields = ("name", "muscle_groups")


@admin.register(WorkoutExercise)
class WorkoutExerciseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "sets",
        "reps_min",
        "reps_max",
        "workout_day",
        "order",
    )
    list_filter = ("workout_day",)
    search_fields = ("name",)


@admin.register(WorkoutSession)
class WorkoutSessionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "workout_day",
        "date",
        "started_at",
        "finished_at",
        "owner",
    )
    list_filter = ("date", "workout_day")
    search_fields = ("notes",)
    date_hierarchy = "date"


@admin.register(WorkoutSessionExercise)
class WorkoutSessionExerciseAdmin(admin.ModelAdmin):
    list_display = ("id", "exercise_name", "session", "sets_target", "order")
    list_filter = ("session",)
    search_fields = ("exercise_name",)


@admin.register(WorkoutSessionSet)
class WorkoutSessionSetAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "session_exercise",
        "set_number",
        "load",
        "load_unit",
        "reps_done",
        "completed",
    )
    list_filter = ("completed", "load_unit")


@admin.register(Food)
class FoodAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "owner", "created_at")
    search_fields = ("name",)


@admin.register(MealType)
class MealTypeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "suggested_time",
        "order",
        "is_active",
        "owner",
    )
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(MenuOption)
class MenuOptionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "meal_type", "order", "owner")
    list_filter = ("meal_type",)
    search_fields = ("name",)


@admin.register(MenuOptionIngredient)
class MenuOptionIngredientAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "food",
        "menu_option",
        "quantity",
        "unit",
        "is_optional",
    )
    list_filter = ("unit", "is_optional")
    search_fields = ("food__name",)


@admin.register(MealLog)
class MealLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "meal_type",
        "menu_option",
        "is_free_meal",
        "date",
        "time",
        "owner",
    )
    list_filter = ("is_free_meal", "date", "meal_type")
    search_fields = ("notes",)
    date_hierarchy = "date"
