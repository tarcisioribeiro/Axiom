import '../utils/formatters.dart';
import 'credit_card_installment.dart';

/// Mirrors `CreditCardPurchaseSerializer`
/// (`apps/api/credit_cards/serializers.py`). Creating one auto-generates
/// [CreditCardInstallment] rows server-side and links them to matching
/// bills by date range — the mobile form only needs to send the purchase
/// itself.
class CreditCardPurchase {
  final int id;
  final String uuid;
  final String description;
  final double totalValue;
  final double? installmentValue;
  final DateTime purchaseDate;
  final String category;
  final int card;
  final String? cardName;
  final int totalInstallments;
  final String? merchant;
  final String? notes;
  final List<CreditCardInstallment> installments;

  const CreditCardPurchase({
    required this.id,
    required this.uuid,
    required this.description,
    required this.totalValue,
    required this.purchaseDate,
    required this.category,
    required this.card,
    required this.totalInstallments,
    this.installmentValue,
    this.cardName,
    this.merchant,
    this.notes,
    this.installments = const [],
  });

  factory CreditCardPurchase.fromJson(Map<String, dynamic> json) =>
      CreditCardPurchase(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        description: json['description'] as String? ?? '',
        totalValue: AppFormatters.toDouble(json['total_value']),
        installmentValue: json['installment_value'] == null
            ? null
            : AppFormatters.toDouble(json['installment_value']),
        purchaseDate:
            AppFormatters.parseApiDate(json['purchase_date'] as String?) ??
                DateTime.now(),
        category: json['category'] as String? ?? '',
        card: json['card'] as int,
        cardName: json['card_name'] as String?,
        totalInstallments: json['total_installments'] as int? ?? 1,
        merchant: json['merchant'] as String?,
        notes: json['notes'] as String?,
        installments: (json['installments'] as List<dynamic>? ?? const [])
            .map((e) =>
                CreditCardInstallment.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'description': description,
        'total_value': totalValue,
        'purchase_date': AppFormatters.apiDate(purchaseDate),
        'category': category,
        'card': card,
        'total_installments': totalInstallments,
        if (merchant != null) 'merchant': merchant,
        if (notes != null) 'notes': notes,
      };
}
