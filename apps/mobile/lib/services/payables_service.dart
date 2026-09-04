import '../models/installment.dart';
import '../models/payable.dart';
import '../utils/formatters.dart';
import 'base_service.dart';

class PayablesService extends BaseService<Payable> {
  PayablesService(super.client)
      : super(
          resourcePath: '/api/v1/payables/',
          fromJson: Payable.fromJson,
          toJson: (payable) => payable.toJson(),
        );

  /// `payables/<id>/pay/` — records a payment, debiting [accountId] and
  /// creating the matching expense server-side. Invalidate accounts and
  /// the payables list afterward.
  Future<void> pay(
    int id, {
    required double value,
    required int accountId,
    required DateTime date,
    String? notes,
  }) async {
    final response = await client.dio.post<Map<String, dynamic>>(
      '$resourcePath$id/pay/',
      data: {
        'value': value,
        'account': accountId,
        'date': AppFormatters.apiDate(date),
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      },
    );
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
  }

  Future<List<Installment>> installments(int id) async {
    final response =
        await client.dio.get<dynamic>('$resourcePath$id/installments/');
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
    final body = response.data;
    final list =
        body is Map ? (body['results'] as List? ?? const []) : body as List;
    return list
        .map((e) => Installment.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
