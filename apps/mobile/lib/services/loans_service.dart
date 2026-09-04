import '../models/installment.dart';
import '../models/loan.dart';
import '../utils/formatters.dart';
import 'base_service.dart';

class LoansService extends BaseService<Loan> {
  LoansService(super.client)
      : super(
          resourcePath: '/api/v1/loans/',
          fromJson: Loan.fromJson,
          toJson: (loan) => loan.toJson(),
        );

  /// `loans/<id>/pay/` — user pays an installment of a loan they took
  /// (`borrowed`). `loans/<id>/receive/` — user records a repayment on a
  /// loan they made (`lent`). Both take `{value, account, date, notes}`.
  Future<void> settle(
    int id, {
    required bool isReceipt,
    required double value,
    required int accountId,
    required DateTime date,
    String? notes,
  }) async {
    final response = await client.dio.post<Map<String, dynamic>>(
      '$resourcePath$id/${isReceipt ? 'receive' : 'pay'}/',
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
