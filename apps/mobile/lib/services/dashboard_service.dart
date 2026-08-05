import '../models/dashboard_stats.dart';
import 'api_client.dart';

/// `dashboard/*` endpoints are plain `APIView`s (not `BaseListCreateView`),
/// so they return raw JSON objects/arrays rather than the
/// `{count,next,previous,results}` envelope — no [BaseService] here.
class DashboardService {
  final ApiClient client;

  DashboardService(this.client);

  Future<DashboardStats> stats() async {
    final response =
        await client.dio.get<Map<String, dynamic>>('/api/v1/dashboard/stats/');
    return DashboardStats.fromJson(response.data!);
  }

  Future<List<FinancialAlert>> financialAlerts() async {
    final response = await client.dio
        .get<List<dynamic>>('/api/v1/dashboard/financial-alerts/');
    return (response.data ?? const [])
        .map((e) => FinancialAlert.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<HealthScore> healthScore() async {
    final response = await client.dio
        .get<Map<String, dynamic>>('/api/v1/dashboard/health-score/');
    return HealthScore.fromJson(response.data!);
  }

  Future<CashFlowForecast> cashFlowForecast({int days = 30}) async {
    final response = await client.dio.get<Map<String, dynamic>>(
      '/api/v1/dashboard/cash-flow-forecast/',
      queryParameters: {'days': days},
    );
    return CashFlowForecast.fromJson(response.data!);
  }
}
