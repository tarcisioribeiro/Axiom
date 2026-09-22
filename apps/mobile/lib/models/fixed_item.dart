import '../utils/formatters.dart';

/// Template de despesa/receita fixa (`FixedExpenseSerializer` /
/// `FixedRevenueSerializer`). Os dois compartilham quase todos os campos;
/// só a despesa pode apontar para cartão de crédito.
class FixedItem {
  final int id;
  final String description;
  final double defaultValue;
  final String category;
  final int? account;
  final String? accountName;
  final int? creditCard;
  final String? creditCardName;
  final int dueDay;
  final bool isActive;
  final bool allowValueEdit;
  final String? lastGeneratedMonth;
  final String? notes;

  const FixedItem({
    required this.id,
    required this.description,
    required this.defaultValue,
    required this.category,
    required this.dueDay,
    required this.isActive,
    required this.allowValueEdit,
    this.account,
    this.accountName,
    this.creditCard,
    this.creditCardName,
    this.lastGeneratedMonth,
    this.notes,
  });

  factory FixedItem.fromJson(Map<String, dynamic> json) => FixedItem(
        id: json['id'] as int,
        description: json['description'] as String? ?? '',
        defaultValue: AppFormatters.toDouble(json['default_value']),
        category: json['category'] as String? ?? '',
        account: json['account'] as int?,
        accountName: json['account_name'] as String?,
        creditCard: json['credit_card'] as int?,
        creditCardName: json['credit_card_name'] as String?,
        dueDay: json['due_day'] as int? ?? 1,
        isActive: json['is_active'] as bool? ?? true,
        allowValueEdit: json['allow_value_edit'] as bool? ?? true,
        lastGeneratedMonth: json['last_generated_month'] as String?,
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'description': description,
        'default_value': defaultValue,
        'category': category,
        'account': account,
        'credit_card': creditCard,
        'due_day': dueDay,
        'is_active': isActive,
        'allow_value_edit': allowValueEdit,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}
