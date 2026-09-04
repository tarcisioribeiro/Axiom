import '../models/installment.dart';
import '../models/receivable.dart';
import '../utils/formatters.dart';
import 'base_service.dart';

class ReceivablesService extends BaseService<Receivable> {
  ReceivablesService(super.client)
      : super(
          resourcePath: '/api/v1/receivables/',
          fromJson: Receivable.fromJson,
          toJson: (receivable) => receivable.toJson(),
        );

  /// `receivables/<id>/receive/` — records a receipt, crediting [accountId]
  /// and creating the matching revenue server-side. Invalidate accounts and
  /// the receivables list afterward.
  Future<void> receive(
    int id, {
    required double value,
    required int accountId,
    required DateTime date,
    String? notes,
  }) async {
    final response = await client.dio.post<Map<String, dynamic>>(
      '$resourcePath$id/receive/',
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
