from django.urls import path

from personal_planning.views import (  # noqa: E501  # Dashboard/RoutineTasks/Goals/Reflections/Instances
    DailyReflectionDetailView,
    DailyReflectionListCreateView,
    ExerciseListCreateView,
    ExerciseRetrieveUpdateDestroyView,
    FoodListCreateView,
    FoodRetrieveUpdateDestroyView,
    GamificationProfileView,
    GoalDetailView,
    GoalListCreateView,
    GoalRecalculateView,
    GoalRegisterFailureView,
    GoalRestartView,
    InstancesForDateView,
    MealLogListCreateView,
    MealLogRetrieveUpdateDestroyView,
    MealTypeListCreateView,
    MealTypeRetrieveUpdateDestroyView,
    MenuOptionIngredientListCreateView,
    MenuOptionIngredientRetrieveUpdateDestroyView,
    MenuOptionListCreateView,
    MenuOptionRetrieveUpdateDestroyView,
    PersonalPlanningAnalyticsView,
    PersonalPlanningDashboardStatsView,
    RoutineTaskDetailView,
    RoutineTaskHeatmapView,
    RoutineTaskListCreateView,
    RoutineTemplateImportView,
    RoutineTemplateListView,
    TaskInstanceBulkUpdateView,
    TaskInstanceDetailView,
    TaskInstanceListCreateView,
    TaskInstanceStatusUpdateView,
    WorkoutDayListCreateView,
    WorkoutDayRetrieveUpdateDestroyView,
    WorkoutExerciseListCreateView,
    WorkoutExerciseRetrieveUpdateDestroyView,
    WorkoutPlanListCreateView,
    WorkoutPlanRetrieveUpdateDestroyView,
    WorkoutSessionExerciseListCreateView,
    WorkoutSessionExerciseRetrieveUpdateDestroyView,
    WorkoutSessionListCreateView,
    WorkoutSessionRetrieveUpdateDestroyView,
    WorkoutSessionSetListCreateView,
    WorkoutSessionSetRetrieveUpdateDestroyView,
)

urlpatterns = [
    # Dashboard
    path(
        "dashboard/stats/",
        PersonalPlanningDashboardStatsView.as_view(),
        name="personal-planning-dashboard-stats",
    ),
    # Analytics
    path(
        "analytics/",
        PersonalPlanningAnalyticsView.as_view(),
        name="personal-planning-analytics",
    ),
    # Routine Tasks
    path(
        "routine-tasks/",
        RoutineTaskListCreateView.as_view(),
        name="routine-task-list-create",
    ),
    path(
        "routine-tasks/heatmap/",
        RoutineTaskHeatmapView.as_view(),
        name="routine-task-heatmap",
    ),
    path(
        "routine-tasks/<int:pk>/",
        RoutineTaskDetailView.as_view(),
        name="routine-task-detail",
    ),
    # Routine Templates (read-only seed data)
    path(
        "routine-templates/",
        RoutineTemplateListView.as_view(),
        name="routine-template-list",
    ),
    path(
        "routine-templates/import/",
        RoutineTemplateImportView.as_view(),
        name="routine-template-import",
    ),
    # Goals
    path("goals/", GoalListCreateView.as_view(), name="goal-list-create"),
    path("goals/<int:pk>/", GoalDetailView.as_view(), name="goal-detail"),
    path(
        "goals/<int:pk>/recalculate/",
        GoalRecalculateView.as_view(),
        name="goal-recalculate",
    ),
    path(
        "goals/<int:pk>/restart/",
        GoalRestartView.as_view(),
        name="goal-restart",
    ),
    path(
        "goals/<int:pk>/register-failure/",
        GoalRegisterFailureView.as_view(),
        name="goal-register-failure",
    ),
    # Daily Reflections
    path(
        "reflections/",
        DailyReflectionListCreateView.as_view(),
        name="daily-reflection-list-create",
    ),
    path(
        "reflections/<int:pk>/",
        DailyReflectionDetailView.as_view(),
        name="daily-reflection-detail",
    ),
    # Task Instances
    path(
        "instances/",
        TaskInstanceListCreateView.as_view(),
        name="task-instance-list-create",
    ),
    path(
        "instances/<int:pk>/",
        TaskInstanceDetailView.as_view(),
        name="task-instance-detail",
    ),
    path(
        "instances/for-date/",
        InstancesForDateView.as_view(),
        name="instances-for-date",
    ),
    path(
        "instances/<int:pk>/status/",
        TaskInstanceStatusUpdateView.as_view(),
        name="task-instance-status-update",
    ),
    path(
        "instances/bulk-update/",
        TaskInstanceBulkUpdateView.as_view(),
        name="task-instance-bulk-update",
    ),
    path(
        "gamification/",
        GamificationProfileView.as_view(),
        name="gamification-profile",
    ),
    # Exercise Catalog
    path(
        "exercises/",
        ExerciseListCreateView.as_view(),
        name="exercise-list-create",
    ),
    path(
        "exercises/<int:pk>/",
        ExerciseRetrieveUpdateDestroyView.as_view(),
        name="exercise-detail",
    ),
    # Workout Plans
    path(
        "workout-plans/",
        WorkoutPlanListCreateView.as_view(),
        name="workout-plan-list-create",
    ),
    path(
        "workout-plans/<int:pk>/",
        WorkoutPlanRetrieveUpdateDestroyView.as_view(),
        name="workout-plan-detail",
    ),
    # Workout Days
    path(
        "workout-days/",
        WorkoutDayListCreateView.as_view(),
        name="workout-day-list-create",
    ),
    path(
        "workout-days/<int:pk>/",
        WorkoutDayRetrieveUpdateDestroyView.as_view(),
        name="workout-day-detail",
    ),
    # Workout Exercises
    path(
        "workout-exercises/",
        WorkoutExerciseListCreateView.as_view(),
        name="workout-exercise-list-create",
    ),
    path(
        "workout-exercises/<int:pk>/",
        WorkoutExerciseRetrieveUpdateDestroyView.as_view(),
        name="workout-exercise-detail",
    ),
    # Workout Sessions
    path(
        "workout-sessions/",
        WorkoutSessionListCreateView.as_view(),
        name="workout-session-list-create",
    ),
    path(
        "workout-sessions/<int:pk>/",
        WorkoutSessionRetrieveUpdateDestroyView.as_view(),
        name="workout-session-detail",
    ),
    # Workout Session Exercises
    path(
        "workout-session-exercises/",
        WorkoutSessionExerciseListCreateView.as_view(),
        name="workout-session-exercise-list-create",
    ),
    path(
        "workout-session-exercises/<int:pk>/",
        WorkoutSessionExerciseRetrieveUpdateDestroyView.as_view(),
        name="workout-session-exercise-detail",
    ),
    # Workout Session Sets
    path(
        "workout-session-sets/",
        WorkoutSessionSetListCreateView.as_view(),
        name="workout-session-set-list-create",
    ),
    path(
        "workout-session-sets/<int:pk>/",
        WorkoutSessionSetRetrieveUpdateDestroyView.as_view(),
        name="workout-session-set-detail",
    ),
    # Foods
    path("foods/", FoodListCreateView.as_view(), name="food-list-create"),
    path(
        "foods/<int:pk>/",
        FoodRetrieveUpdateDestroyView.as_view(),
        name="food-detail",
    ),
    # Meal Types
    path(
        "meal-types/",
        MealTypeListCreateView.as_view(),
        name="meal-type-list-create",
    ),
    path(
        "meal-types/<int:pk>/",
        MealTypeRetrieveUpdateDestroyView.as_view(),
        name="meal-type-detail",
    ),
    # Menu Options
    path(
        "menu-options/",
        MenuOptionListCreateView.as_view(),
        name="menu-option-list-create",
    ),
    path(
        "menu-options/<int:pk>/",
        MenuOptionRetrieveUpdateDestroyView.as_view(),
        name="menu-option-detail",
    ),
    # Menu Option Ingredients
    path(
        "menu-option-ingredients/",
        MenuOptionIngredientListCreateView.as_view(),
        name="menu-option-ingredient-list-create",
    ),
    path(
        "menu-option-ingredients/<int:pk>/",
        MenuOptionIngredientRetrieveUpdateDestroyView.as_view(),
        name="menu-option-ingredient-detail",
    ),
    # Meal Logs
    path(
        "meal-logs/",
        MealLogListCreateView.as_view(),
        name="meal-log-list-create",
    ),
    path(
        "meal-logs/<int:pk>/",
        MealLogRetrieveUpdateDestroyView.as_view(),
        name="meal-log-detail",
    ),
]
