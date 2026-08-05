import '../models/credit_card_bill.dart';
import '../models/credit_card_installment.dart';
import '../utils/formatters.dart';
import 'base_service.dart';

class CreditCardBillsService extends BaseService<CreditCardBill> {
  CreditCardBillsService(super.client)
      : super(
          resourcePath: '/api/v1/credit-cards-bills/',
          fromJson: CreditCardBill.fromJson,
          // Bills are only created/updated implicitly by purchases/payments
          // on the mobile app — no manual bill-editing form in Tier 1.
          toJson: (bill) => {},
        );

  Future<CreditCardBill> pay(
    int id, {
    required double amount,
    required DateTime paymentDate,
    String? notes,
  }) async {
    final response = await client.dio.post<Map<String, dynamic>>(
      '$resourcePath$id/pay/',
      data: {
        'amount': amount,
        'payment_date': AppFormatters.apiDate(paymentDate),
        if (notes != null) 'notes': notes,
      },
    );
    return CreditCardBill.fromJson(response.data!);
  }

  Future<CreditCardBill> reopen(int id) async {
    final response =
        await client.dio.post<Map<String, dynamic>>('$resourcePath$id/reopen/');
    return CreditCardBill.fromJson(response.data!);
  }

  Future<CreditCardBill> renegotiate(
    int id, {
    required double totalWithInterest,
    required int installments,
    DateTime? startDate,
  }) async {
    final response = await client.dio.post<Map<String, dynamic>>(
      '$resourcePath$id/renegotiate/',
      data: {
        'total_with_interest': totalWithInterest,
        'installments': installments,
        if (startDate != null) 'start_date': AppFormatters.apiDate(startDate),
      },
    );
    return CreditCardBill.fromJson(response.data!);
  }

  Future<List<CreditCardInstallment>> items(int id) async {
    final response =
        await client.dio.get<List<dynamic>>('$resourcePath$id/items/');
    return (response.data ?? const [])
        .map((e) => CreditCardInstallment.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
