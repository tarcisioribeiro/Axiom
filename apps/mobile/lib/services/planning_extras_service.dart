import 'package:dio/dio.dart';

import '../models/habit_heatmap.dart';
import 'api_client.dart';
import 'base_service.dart';

/// The non-CRUD `personal-planning/*` endpoints the app uses: the habit
/// consistency heatmap and the two AI generators (workout plan / weekly
/// menu). Both AI endpoints persist their result server-side and return a
/// small summary.
class PlanningExtrasService {
  final ApiClient client;

  PlanningExtrasService(this.client);

  static const _base = '/api/v1/personal-planning/';

  Future<HabitHeatmap> heatmap({required int year, int? taskId}) async {
    final response = await client.dio.get<Map<String, dynamic>>(
      '${_base}routine-tasks/heatmap/',
      queryParameters: {
        'year': year,
        if (taskId != null) 'task_id': taskId,
      },
    );
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
    return HabitHeatmap.fromJson(response.data!);
  }

  /// `ai-workout-plan/` — generates and persists a `WorkoutPlan` with days
  /// and exercises. Returns `{plan_id, name, days_created}`.
  Future<Map<String, dynamic>> generateWorkoutPlan({
    required String goal,
    required String level,
    required String equipment,
    required int daysPerWeek,
  }) {
    return _post('${_base}ai-workout-plan/', {
      'goal': goal,
      'level': level,
      'equipment': equipment,
      'days_per_week': daysPerWeek,
    });
  }

  /// `ai-menu-plan/` — generates and persists meal types with 2 options each.
  Future<Map<String, dynamic>> generateMenuPlan({
    required int calories,
    required String preferences,
    required String restrictions,
    required int mealsPerDay,
  }) {
    return _post('${_base}ai-menu-plan/', {
      'calories': calories,
      'preferences': preferences,
      'restrictions': restrictions,
      'meals_per_day': mealsPerDay,
    });
  }

  Future<Map<String, dynamic>> _post(
      String path, Map<String, dynamic> data) async {
    try {
      final response = await client.dio.post<Map<String, dynamic>>(
        path,
        data: data,
        // LLM generation runs well past the 15s default receive timeout.
        options: Options(
          receiveTimeout: const Duration(seconds: 180),
          validateStatus: (s) => s != null && s < 500,
        ),
      );
      if ((response.statusCode ?? 0) >= 400) {
        throw ApiException(response.statusCode, response.data);
      }
      final body = response.data ?? const <String, dynamic>{};
      if (body['error'] != null) {
        throw ApiException(response.statusCode, {'detail': body['error']});
      }
      return body;
    } on DioException catch (e) {
      throw ApiException(
        e.response?.statusCode,
        e.response?.data ??
            {
              'detail': 'A geração demorou demais ou o serviço de IA está '
                  'indisponível. Tente de novo mais tarde.'
            },
      );
    }
  }
}
