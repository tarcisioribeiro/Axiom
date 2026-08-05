import '../utils/formatters.dart';

/// Mirrors `CreditCardBillSerializer`
/// (`apps/api/credit_cards/serializers.py`). `year`/`month` come back as
/// strings (`"2026"`, `"Aug"`) — kept as-is since they're only ever
/// displayed, never computed on.
class CreditCardBill {
  final int id;
  final String uuid;
  final int creditCard;
  final String? creditCardOnCardName;
  final String? creditCardNumberMasked;
  final String? creditCardFlag;
  final String year;
  final String month;
  final DateTime? invoiceBeginningDate;
  final DateTime? invoiceEndingDate;
  final bool closed;
  final double totalAmount;
  final double minimumPayment;
  final DateTime? dueDate;
  final double paidAmount;
  final DateTime? paymentDate;
  final String status;

  const CreditCardBill({
    required this.id,
    required this.uuid,
    required this.creditCard,
    required this.year,
    required this.month,
    required this.closed,
    required this.totalAmount,
    required this.minimumPayment,
    required this.paidAmount,
    required this.status,
    this.creditCardOnCardName,
    this.creditCardNumberMasked,
    this.creditCardFlag,
    this.invoiceBeginningDate,
    this.invoiceEndingDate,
    this.dueDate,
    this.paymentDate,
  });

  double get remaining => (totalAmount - paidAmount).clamp(0, double.infinity);

  factory CreditCardBill.fromJson(Map<String, dynamic> json) => CreditCardBill(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        creditCard: json['credit_card'] as int,
        creditCardOnCardName: json['credit_card_on_card_name'] as String?,
        creditCardNumberMasked: json['credit_card_number_masked'] as String?,
        creditCardFlag: json['credit_card_flag'] as String?,
        year: json['year']?.toString() ?? '',
        month: json['month']?.toString() ?? '',
        invoiceBeginningDate: AppFormatters.parseApiDate(
          json['invoice_beginning_date'] as String?,
        ),
        invoiceEndingDate: AppFormatters.parseApiDate(
          json['invoice_ending_date'] as String?,
        ),
        closed: json['closed'] as bool? ?? false,
        totalAmount: AppFormatters.toDouble(json['total_amount']),
        minimumPayment: AppFormatters.toDouble(json['minimum_payment']),
        dueDate: AppFormatters.parseApiDate(json['due_date'] as String?),
        paidAmount: AppFormatters.toDouble(json['paid_amount']),
        paymentDate:
            AppFormatters.parseApiDate(json['payment_date'] as String?),
        status: json['status'] as String? ?? 'open',
      );
}
