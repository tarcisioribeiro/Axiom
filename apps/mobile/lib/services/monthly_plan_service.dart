import '../models/monthly_plan.dart';
import 'api_client.dart';
import 'base_service.dart';

class MonthlyPlanService {
  final ApiClient client;
  const MonthlyPlanService(this.client);

  static const _base = '/api/v1/monthly-plan/';

  Future<MonthlyPlanSummary> summary(int month, int year) async {
    final r = await client.dio.get<Map<String, dynamic>>(
      '${_base}summary/',
      queryParameters: {'month': month, 'year': year},
    );
    _check(r.statusCode, r.data);
    return MonthlyPlanSummary.fromJson(r.data!);
  }

  Future<void> save(int id, MonthlyPlan plan) async {
    final r = await client.dio
        .patch<Map<String, dynamic>>('$_base$id/', data: plan.toJson());
    _check(r.statusCode, r.data);
  }

  /// Gera fixas e cria orçamentos; devolve `results` (contagens).
  Future<Map<String, dynamic>> apply(int id) async {
    final r = await client.dio.post<Map<String, dynamic>>('$_base$id/apply/');
    _check(r.statusCode, r.data);
    return (r.data?['results'] as Map<String, dynamic>?) ?? const {};
  }

  void _check(int? status, dynamic data) {
    if ((status ?? 0) >= 400) throw ApiException(status, data);
  }
}
