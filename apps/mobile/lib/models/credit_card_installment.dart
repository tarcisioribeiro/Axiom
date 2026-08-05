import '../utils/formatters.dart';

/// Mirrors `CreditCardInstallmentSerializer`
/// (`apps/api/credit_cards/serializers.py`) — one row per parcela of a
/// `CreditCardPurchase`, optionally linked to a `CreditCardBill`.
class CreditCardInstallment {
  final int id;
  final String uuid;
  final int purchase;
  final int installmentNumber;
  final double value;
  final DateTime? dueDate;
  final int? bill;
  final bool payed;
  final String? description;
  final String? category;
  final int? totalInstallments;
  final String? merchant;

  const CreditCardInstallment({
    required this.id,
    required this.uuid,
    required this.purchase,
    required this.installmentNumber,
    required this.value,
    required this.payed,
    this.dueDate,
    this.bill,
    this.description,
    this.category,
    this.totalInstallments,
    this.merchant,
  });

  factory CreditCardInstallment.fromJson(Map<String, dynamic> json) =>
      CreditCardInstallment(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        purchase: json['purchase'] as int,
        installmentNumber: json['installment_number'] as int? ?? 1,
        value: AppFormatters.toDouble(json['value']),
        dueDate: AppFormatters.parseApiDate(json['due_date'] as String?),
        bill: json['bill'] as int?,
        payed: json['payed'] as bool? ?? false,
        description: json['description'] as String?,
        category: json['category'] as String?,
        totalInstallments: json['total_installments'] as int?,
        merchant: json['merchant'] as String?,
      );
}
