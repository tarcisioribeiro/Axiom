import '../models/gamification_profile.dart';
import 'api_client.dart';

/// `personal-planning/dashboard/stats/` and `personal-planning/
/// gamification/` are plain `APIView`s — raw JSON objects, no
/// [BaseService] pagination envelope.
class PlanningDashboardService {
  final ApiClient client;

  PlanningDashboardService(this.client);

  Future<PlanningStats> stats() async {
    final response = await client.dio.get<Map<String, dynamic>>(
      '/api/v1/personal-planning/dashboard/stats/',
    );
    return PlanningStats.fromJson(response.data!);
  }

  Future<GamificationProfile> gamification() async {
    final response = await client.dio
        .get<Map<String, dynamic>>('/api/v1/personal-planning/gamification/');
    return GamificationProfile.fromJson(response.data!);
  }
}
