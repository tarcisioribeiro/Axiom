import '../utils/formatters.dart';

/// Orçamento mensal por categoria (`BudgetSerializer`).
class Budget {
  final int id;
  final String category;
  final double limitAmount;
  final int month;
  final int year;
  final bool rolloverEnabled;

  const Budget({
    required this.id,
    required this.category,
    required this.limitAmount,
    required this.month,
    required this.year,
    required this.rolloverEnabled,
  });

  factory Budget.fromJson(Map<String, dynamic> json) => Budget(
        id: json['id'] as int,
        category: json['category'] as String? ?? '',
        limitAmount: AppFormatters.toDouble(json['limit_amount']),
        month: json['month'] as int,
        year: json['year'] as int,
        rolloverEnabled: json['rollover_enabled'] as bool? ?? false,
      );
}

/// Item de `budgets/status/` — limite efetivo vs gasto real do mês.
/// `status`: `ok` | `warning` | `exceeded`.
class BudgetStatus {
  final int id;
  final String category;
  final double limitAmount;
  final double effectiveLimit;
  final double actualSpent;
  final double percentage;
  final String status;
  final bool rolloverEnabled;

  const BudgetStatus({
    required this.id,
    required this.category,
    required this.limitAmount,
    required this.effectiveLimit,
    required this.actualSpent,
    required this.percentage,
    required this.status,
    this.rolloverEnabled = false,
  });

  factory BudgetStatus.fromJson(Map<String, dynamic> json) => BudgetStatus(
        id: json['id'] as int,
        category: json['category'] as String? ?? '',
        limitAmount: AppFormatters.toDouble(json['limit_amount']),
        effectiveLimit: AppFormatters.toDouble(json['effective_limit']),
        actualSpent: AppFormatters.toDouble(json['actual_spent']),
        percentage: AppFormatters.toDouble(json['percentage']),
        status: json['status'] as String? ?? 'ok',
      );
}
