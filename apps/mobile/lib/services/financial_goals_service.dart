import '../models/financial_goal.dart';
import 'base_service.dart';

class FinancialGoalsService extends BaseService<FinancialGoal> {
  FinancialGoalsService(super.client)
      : super(
          resourcePath: '/api/v1/financial-goals/',
          fromJson: FinancialGoal.fromJson,
          toJson: (g) => g.toJson(),
        );

  Future<void> addVaults(int id, List<int> vaultIds) =>
      _op('$resourcePath$id/add-vaults/', {'vault_ids': vaultIds});

  Future<void> removeVaults(int id, List<int> vaultIds) =>
      _op('$resourcePath$id/remove-vaults/', {'vault_ids': vaultIds});

  Future<void> _op(String path, Map<String, dynamic> data) async {
    final response =
        await client.dio.post<Map<String, dynamic>>(path, data: data);
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
  }
}
