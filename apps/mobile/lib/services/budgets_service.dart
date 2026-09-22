import '../models/budget.dart';
import 'base_service.dart';

class BudgetsService extends BaseService<Budget> {
  BudgetsService(super.client)
      : super(
          resourcePath: '/api/v1/budgets/',
          fromJson: Budget.fromJson,
          toJson: (b) =>
              {'category': b.category, 'limit_amount': b.limitAmount},
        );

  Future<List<BudgetStatus>> status(int month, int year) async {
    final r = await client.dio.get<dynamic>(
      '${resourcePath}status/',
      queryParameters: {'month': month, 'year': year},
    );
    if ((r.statusCode ?? 0) >= 400) throw ApiException(r.statusCode, r.data);
    final data = r.data;
    final list = data is Map ? (data['results'] ?? const []) : data;
    return (list as List)
        .map((e) => BudgetStatus.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
