import '../models/meal_log.dart';
import 'base_service.dart';

class MealLogsService extends BaseService<MealLog> {
  MealLogsService(super.client)
      : super(
          resourcePath: '/api/v1/personal-planning/meal-logs/',
          fromJson: MealLog.fromJson,
          toJson: (log) => log.toJson(),
        );

  Future<Map<String, dynamic>> dailyCaloricSummary(DateTime date) async {
    final response = await client.dio.get<Map<String, dynamic>>(
      '/api/v1/personal-planning/daily-caloric-summary/',
      queryParameters: {'date': date.toIso8601String().split('T').first},
    );
    return response.data ?? const {};
  }
}
