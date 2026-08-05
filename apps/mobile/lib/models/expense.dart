import '../utils/formatters.dart';

/// Mirrors the subset of `ExpenseSerializer`
/// (`apps/api/expenses/serializers.py`) the mobile app's quick-entry form
/// needs. Fields the web app supports but this Tier 1 screen doesn't expose
/// (splits, receipts, tags, recurrence) are left off the write payload —
/// the API defaults them fine on create.
class Expense {
  final int id;
  final String uuid;
  final String description;
  final double value;
  final DateTime date;
  final String category;
  final int account;
  final String? accountName;
  final bool payed;
  final String? paymentMethod;
  final String? merchant;
  final String? notes;

  const Expense({
    required this.id,
    required this.uuid,
    required this.description,
    required this.value,
    required this.date,
    required this.category,
    required this.account,
    required this.payed,
    this.accountName,
    this.paymentMethod,
    this.merchant,
    this.notes,
  });

  factory Expense.fromJson(Map<String, dynamic> json) => Expense(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        description: json['description'] as String? ?? '',
        value: AppFormatters.toDouble(json['value']),
        date: AppFormatters.parseApiDate(json['date'] as String?) ??
            DateTime.now(),
        category: json['category'] as String? ?? '',
        account: json['account'] as int,
        accountName: json['account_name'] as String?,
        payed: json['payed'] as bool? ?? false,
        paymentMethod: json['payment_method'] as String?,
        merchant: json['merchant'] as String?,
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'description': description,
        'value': value,
        'date': AppFormatters.apiDate(date),
        'category': category,
        'account': account,
        'payed': payed,
        if (paymentMethod != null) 'payment_method': paymentMethod,
        if (merchant != null) 'merchant': merchant,
        if (notes != null) 'notes': notes,
      };
}
