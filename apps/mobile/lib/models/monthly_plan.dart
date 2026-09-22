import '../utils/formatters.dart';

/// Override de um item fixo no plano: `enabled` liga/desliga, `value`
/// (string decimal) substitui o valor padrão quando não nulo.
class FixedOverride {
  final bool enabled;
  final String? value;
  const FixedOverride({this.enabled = true, this.value});

  factory FixedOverride.fromJson(Map<String, dynamic> j) => FixedOverride(
      enabled: j['enabled'] as bool? ?? true, value: j['value']?.toString());

  Map<String, dynamic> toJson() => {'enabled': enabled, 'value': value};
}

/// Receita/despesa extra planejada (só existe dentro do plano).
class ExtraItem {
  final String description;
  final String value;
  final String category;
  final bool enabled;
  const ExtraItem({
    required this.description,
    required this.value,
    required this.category,
    this.enabled = true,
  });

  factory ExtraItem.fromJson(Map<String, dynamic> j) => ExtraItem(
        description: j['description'] as String? ?? '',
        value: j['value']?.toString() ?? '',
        category: j['category'] as String? ?? '',
        enabled: j['enabled'] as bool? ?? true,
      );

  ExtraItem copyWith({String? description, String? value, bool? enabled}) =>
      ExtraItem(
        description: description ?? this.description,
        value: value ?? this.value,
        category: category,
        enabled: enabled ?? this.enabled,
      );

  double get amount => double.tryParse(value.replaceAll(',', '.')) ?? 0;

  Map<String, dynamic> toJson() => {
        'description': description,
        'value': value,
        'category': category,
        'enabled': enabled,
      };
}

/// Estado editável do plano (`MonthlyPlanSerializer`).
class MonthlyPlan {
  final int id;
  final int month;
  final int year;
  final DateTime? appliedAt;
  final List<ExtraItem> extraRevenues;
  final List<ExtraItem> extraExpenses;
  final Map<String, String> budgetOverrides;
  final Map<String, FixedOverride> fixedRevenueOverrides;
  final Map<String, FixedOverride> fixedExpenseOverrides;
  final Map<String, bool> billOverrides;
  final List<String> budgetDisabledCategories;

  const MonthlyPlan({
    required this.id,
    required this.month,
    required this.year,
    required this.appliedAt,
    required this.extraRevenues,
    required this.extraExpenses,
    required this.budgetOverrides,
    required this.fixedRevenueOverrides,
    required this.fixedExpenseOverrides,
    required this.billOverrides,
    required this.budgetDisabledCategories,
  });

  static List<ExtraItem> _extras(dynamic v) => ((v as List?) ?? const [])
      .map((e) => ExtraItem.fromJson(e as Map<String, dynamic>))
      .toList();

  static Map<String, FixedOverride> _overrides(dynamic v) =>
      ((v as Map?) ?? const {}).map((k, e) => MapEntry(
          k as String, FixedOverride.fromJson(e as Map<String, dynamic>)));

  factory MonthlyPlan.fromJson(Map<String, dynamic> j) => MonthlyPlan(
        id: j['id'] as int,
        month: j['month'] as int,
        year: j['year'] as int,
        appliedAt: DateTime.tryParse(j['applied_at'] as String? ?? ''),
        extraRevenues: _extras(j['extra_revenues']),
        extraExpenses: _extras(j['extra_expenses']),
        budgetOverrides: ((j['budget_overrides'] as Map?) ?? const {})
            .map((k, v) => MapEntry(k as String, v.toString())),
        fixedRevenueOverrides: _overrides(j['fixed_revenue_overrides']),
        fixedExpenseOverrides: _overrides(j['fixed_expense_overrides']),
        billOverrides: ((j['bill_overrides'] as Map?) ?? const {})
            .map((k, v) => MapEntry(k as String, v as bool)),
        budgetDisabledCategories:
            ((j['budget_disabled_categories'] as List?) ?? const [])
                .map((e) => e as String)
                .toList(),
      );

  Map<String, dynamic> toJson() => {
        'extra_revenues': extraRevenues.map((e) => e.toJson()).toList(),
        'extra_expenses': extraExpenses.map((e) => e.toJson()).toList(),
        'budget_overrides': budgetOverrides,
        'fixed_revenue_overrides':
            fixedRevenueOverrides.map((k, v) => MapEntry(k, v.toJson())),
        'fixed_expense_overrides':
            fixedExpenseOverrides.map((k, v) => MapEntry(k, v.toJson())),
        'bill_overrides': billOverrides,
        'budget_disabled_categories': budgetDisabledCategories,
      };

  MonthlyPlan copyWith({
    List<ExtraItem>? extraRevenues,
    List<ExtraItem>? extraExpenses,
    Map<String, String>? budgetOverrides,
    Map<String, FixedOverride>? fixedRevenueOverrides,
    Map<String, FixedOverride>? fixedExpenseOverrides,
    Map<String, bool>? billOverrides,
    List<String>? budgetDisabledCategories,
  }) =>
      MonthlyPlan(
        id: id,
        month: month,
        year: year,
        appliedAt: appliedAt,
        extraRevenues: extraRevenues ?? this.extraRevenues,
        extraExpenses: extraExpenses ?? this.extraExpenses,
        budgetOverrides: budgetOverrides ?? this.budgetOverrides,
        fixedRevenueOverrides:
            fixedRevenueOverrides ?? this.fixedRevenueOverrides,
        fixedExpenseOverrides:
            fixedExpenseOverrides ?? this.fixedExpenseOverrides,
        billOverrides: billOverrides ?? this.billOverrides,
        budgetDisabledCategories:
            budgetDisabledCategories ?? this.budgetDisabledCategories,
      );
}

class PlanFixedItem {
  final int id;
  final String description;
  final double defaultValue;
  final int dueDay;
  final String sub;
  final bool alreadyPosted;

  /// Recebida (receita) / paga (despesa em conta) / lançada (despesa em
  /// cartão) neste mês — a linha fica travada e sai dos overrides.
  final bool settled;
  final bool onCard;

  const PlanFixedItem({
    required this.id,
    required this.description,
    required this.defaultValue,
    required this.dueDay,
    required this.sub,
    required this.alreadyPosted,
    required this.settled,
    required this.onCard,
  });

  factory PlanFixedItem.revenue(Map<String, dynamic> j) => PlanFixedItem(
        id: j['id'] as int,
        description: j['description'] as String? ?? '',
        defaultValue: AppFormatters.toDouble(j['default_value']),
        dueDay: j['due_day'] as int? ?? 1,
        sub: j['account_name'] as String? ?? '',
        alreadyPosted: j['already_posted'] as bool? ?? false,
        settled: j['already_received'] as bool? ?? false,
        onCard: false,
      );

  factory PlanFixedItem.expense(Map<String, dynamic> j) {
    final card = (j['credit_card_name'] as String?) ?? '';
    return PlanFixedItem(
      id: j['id'] as int,
      description: j['description'] as String? ?? '',
      defaultValue: AppFormatters.toDouble(j['default_value']),
      dueDay: j['due_day'] as int? ?? 1,
      sub: card.isNotEmpty ? card : (j['account_name'] as String? ?? ''),
      alreadyPosted: j['already_posted'] as bool? ?? false,
      settled: j['already_paid'] as bool? ?? false,
      onCard: card.isNotEmpty,
    );
  }
}

class PlanBill {
  final int id;
  final String cardName;
  final double total;
  final String? dueDate;
  final String status;
  const PlanBill({
    required this.id,
    required this.cardName,
    required this.total,
    required this.dueDate,
    required this.status,
  });

  factory PlanBill.fromJson(Map<String, dynamic> j) => PlanBill(
        id: j['id'] as int,
        cardName: j['credit_card_name'] as String? ?? '',
        total: AppFormatters.toDouble(j['total_amount']),
        dueDate: j['due_date'] as String?,
        status: j['status'] as String? ?? '',
      );
}

class PlanBudgetSuggestion {
  final String category;
  final double suggested;
  const PlanBudgetSuggestion(this.category, this.suggested);
}

/// Resposta de `monthly-plan/summary/`.
class MonthlyPlanSummary {
  final MonthlyPlan plan;
  final List<PlanFixedItem> fixedRevenues;
  final List<PlanFixedItem> fixedExpenses;
  final List<PlanBill> bills;
  final Map<String, double> existingBudgets;
  final List<PlanBudgetSuggestion> suggestions;
  final double actualRevenues;
  final double actualExpenses;
  final double openingBalance;
  final double totalOverdraft;
  final double registeredExpensesNet;

  const MonthlyPlanSummary({
    required this.plan,
    required this.fixedRevenues,
    required this.fixedExpenses,
    required this.bills,
    required this.existingBudgets,
    required this.suggestions,
    required this.actualRevenues,
    required this.actualExpenses,
    required this.openingBalance,
    required this.totalOverdraft,
    required this.registeredExpensesNet,
  });

  static List<Map<String, dynamic>> _list(dynamic v) =>
      ((v as List?) ?? const []).cast<Map<String, dynamic>>();

  factory MonthlyPlanSummary.fromJson(Map<String, dynamic> j) {
    final actual = (j['actual'] as Map?) ?? const {};
    return MonthlyPlanSummary(
      plan: MonthlyPlan.fromJson(j['plan'] as Map<String, dynamic>),
      fixedRevenues:
          _list(j['fixed_revenues']).map(PlanFixedItem.revenue).toList(),
      fixedExpenses:
          _list(j['fixed_expenses']).map(PlanFixedItem.expense).toList(),
      bills: _list(j['credit_card_bills']).map(PlanBill.fromJson).toList(),
      existingBudgets: {
        for (final b in _list(j['existing_budgets']))
          b['category'] as String: AppFormatters.toDouble(b['limit_amount']),
      },
      suggestions: [
        for (final s in _list(j['budget_suggestions']))
          PlanBudgetSuggestion(
            s['category'] as String,
            AppFormatters.toDouble(s['suggested_limit']),
          ),
      ],
      actualRevenues: AppFormatters.toDouble(actual['revenues']),
      actualExpenses: AppFormatters.toDouble(actual['expenses']),
      openingBalance: AppFormatters.toDouble(j['opening_balance']),
      totalOverdraft: AppFormatters.toDouble(j['total_overdraft_limit']),
      registeredExpensesNet:
          AppFormatters.toDouble(j['registered_expenses_net']),
    );
  }
}
