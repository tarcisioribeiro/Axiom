import '../models/vault.dart';
import 'base_service.dart';

class VaultsService extends BaseService<Vault> {
  VaultsService(super.client)
      : super(
          resourcePath: '/api/v1/vaults/',
          fromJson: Vault.fromJson,
          toJson: (v) => v.toJson(),
        );

  Future<void> deposit(int id, {required double amount, String? description}) =>
      _op('$resourcePath$id/deposit/', {
        'amount': amount,
        if (description != null) 'description': description
      });

  Future<void> withdraw(int id,
          {required double amount, String? description}) =>
      _op('$resourcePath$id/withdraw/', {
        'amount': amount,
        if (description != null) 'description': description
      });

  /// `apply-yield/` — books the pending yield as a Revenue and updates the
  /// account balance server-side. No body.
  Future<void> applyYield(int id) => _op('$resourcePath$id/apply-yield/', {});

  /// `update-yield/` — change the annual rate (and optionally recalculate).
  Future<void> updateYield(int id, {required double annualYieldRate}) => _op(
        '$resourcePath$id/update-yield/',
        {'annual_yield_rate': annualYieldRate, 'recalculate': false},
      );

  Future<List<VaultTransaction>> transactions(int id) async {
    final response =
        await client.dio.get<dynamic>('$resourcePath$id/transactions/');
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
    final body = response.data;
    final results =
        body is Map ? (body['results'] as List? ?? const []) : body as List;
    return results
        .map((e) => VaultTransaction.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> _op(String path, Map<String, dynamic> data) async {
    final response =
        await client.dio.post<Map<String, dynamic>>(path, data: data);
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
  }
}
