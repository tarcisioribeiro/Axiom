import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/exercise_catalog.dart';
import '../models/food.dart';
import '../models/gamification_profile.dart';
import '../models/goal.dart';
import '../models/meal_log.dart';
import '../models/meal_type.dart';
import '../models/routine_task.dart';
import '../models/task_instance.dart';
import '../models/workout_plan.dart';
import '../models/workout_session.dart';
import '../services/exercise_catalog_service.dart';
import '../services/foods_service.dart';
import '../services/goals_service.dart';
import '../services/meal_logs_service.dart';
import '../services/meal_types_service.dart';
import '../services/planning_dashboard_service.dart';
import '../services/routine_tasks_service.dart';
import '../services/task_instances_service.dart';
import '../services/workout_plans_service.dart';
import '../services/workout_sessions_service.dart';
import 'core_providers.dart';

final routineTasksServiceProvider =
    Provider((ref) => RoutineTasksService(ref.watch(apiClientProvider)));
final taskInstancesServiceProvider =
    Provider((ref) => TaskInstancesService(ref.watch(apiClientProvider)));
final goalsServiceProvider =
    Provider((ref) => GoalsService(ref.watch(apiClientProvider)));
final planningDashboardServiceProvider = Provider(
  (ref) => PlanningDashboardService(ref.watch(apiClientProvider)),
);
final workoutPlansServiceProvider =
    Provider((ref) => WorkoutPlansService(ref.watch(apiClientProvider)));
final exerciseCatalogServiceProvider =
    Provider((ref) => ExerciseCatalogService(ref.watch(apiClientProvider)));
final workoutSessionsServiceProvider =
    Provider((ref) => WorkoutSessionsService(ref.watch(apiClientProvider)));
final foodsServiceProvider =
    Provider((ref) => FoodsService(ref.watch(apiClientProvider)));
final mealTypesServiceProvider =
    Provider((ref) => MealTypesService(ref.watch(apiClientProvider)));
final mealLogsServiceProvider =
    Provider((ref) => MealLogsService(ref.watch(apiClientProvider)));

final routineTasksProvider = FutureProvider.autoDispose<List<RoutineTask>>(
  (ref) => ref.watch(routineTasksServiceProvider).getAll(),
);

/// Keyed by a date normalized to midnight so repeated calls for "today"
/// within the same day hit the same cache entry.
final taskInstancesForDateProvider =
    FutureProvider.autoDispose.family<TaskInstancesForDate, DateTime>(
  (ref, date) => ref.watch(taskInstancesServiceProvider).forDate(date),
);

final goalsProvider = FutureProvider.autoDispose<List<Goal>>(
  (ref) => ref.watch(goalsServiceProvider).getAll(),
);

final planningStatsProvider = FutureProvider.autoDispose<PlanningStats>(
  (ref) => ref.watch(planningDashboardServiceProvider).stats(),
);

final gamificationProvider = FutureProvider.autoDispose<GamificationProfile>(
  (ref) => ref.watch(planningDashboardServiceProvider).gamification(),
);

final workoutPlansProvider = FutureProvider.autoDispose<List<WorkoutPlan>>(
  (ref) => ref.watch(workoutPlansServiceProvider).getAll(),
);

final exerciseCatalogProvider =
    FutureProvider.autoDispose<List<ExerciseCatalog>>(
  (ref) => ref.watch(exerciseCatalogServiceProvider).getAll(),
);

final workoutSessionsProvider =
    FutureProvider.autoDispose<List<WorkoutSession>>(
  (ref) => ref.watch(workoutSessionsServiceProvider).getAll(),
);

final foodsProvider = FutureProvider.autoDispose<List<Food>>(
  (ref) => ref.watch(foodsServiceProvider).getAll(),
);

final mealTypesProvider = FutureProvider.autoDispose<List<MealType>>(
  (ref) => ref.watch(mealTypesServiceProvider).getAll(),
);

final mealLogsProvider = FutureProvider.autoDispose<List<MealLog>>(
  (ref) => ref.watch(mealLogsServiceProvider).getAll(),
);

final dailyCaloricSummaryProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, DateTime>(
  (ref, date) => ref.watch(mealLogsServiceProvider).dailyCaloricSummary(date),
);
