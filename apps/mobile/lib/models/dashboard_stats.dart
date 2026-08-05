import '../utils/formatters.dart';

/// Mirrors `dashboard/stats/` (`DashboardStatsView`) — current-month
/// aggregate numbers, the mobile dashboard's headline StatCards.
class DashboardStats {
  final double totalBalance;
  final double totalExpenses;
  final double totalRevenues;
  final double totalCreditLimit;
  final double usedCreditLimit;
  final double availableCreditLimit;
  final int accountsCount;
  final int creditCardsCount;

  const DashboardStats({
    required this.totalBalance,
    required this.totalExpenses,
    required this.totalRevenues,
    required this.totalCreditLimit,
    required this.usedCreditLimit,
    required this.availableCreditLimit,
    required this.accountsCount,
    required this.creditCardsCount,
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) => DashboardStats(
        totalBalance: AppFormatters.toDouble(json['total_balance']),
        totalExpenses: AppFormatters.toDouble(json['total_expenses']),
        totalRevenues: AppFormatters.toDouble(json['total_revenues']),
        totalCreditLimit: AppFormatters.toDouble(json['total_credit_limit']),
        usedCreditLimit: AppFormatters.toDouble(json['used_credit_limit']),
        availableCreditLimit:
            AppFormatters.toDouble(json['available_credit_limit']),
        accountsCount: json['accounts_count'] as int? ?? 0,
        creditCardsCount: json['credit_cards_count'] as int? ?? 0,
      );
}

/// A single `financial-alerts/` entry.
class FinancialAlert {
  final String type;
  final String severity;
  final String message;
  final String? link;

  const FinancialAlert({
    required this.type,
    required this.severity,
    required this.message,
    this.link,
  });

  bool get isDanger => severity == 'danger';

  factory FinancialAlert.fromJson(Map<String, dynamic> json) => FinancialAlert(
        type: json['type'] as String? ?? '',
        severity: json['severity'] as String? ?? 'warning',
        message: json['message'] as String? ?? '',
        link: json['link'] as String?,
      );
}

/// `dashboard/health-score/`.
class HealthScore {
  final int score;
  final String grade;

  const HealthScore({required this.score, required this.grade});

  factory HealthScore.fromJson(Map<String, dynamic> json) => HealthScore(
        score: json['score'] as int? ?? 0,
        grade: json['grade'] as String? ?? '-',
      );
}

/// One `{category, total, count}` entry from
/// `dashboard/credit-card-expenses-by-category/` or the derived expense/
/// revenue category breakdowns computed client-side from list data.
class CategoryAmount {
  final String category;
  final double total;

  const CategoryAmount({required this.category, required this.total});

  factory CategoryAmount.fromJson(Map<String, dynamic> json) => CategoryAmount(
        category: json['category'] as String? ?? '',
        total: AppFormatters.toDouble(json['total']),
      );
}

/// A single day of `dashboard/cash-flow-forecast/`'s `daily_breakdown`.
class CashFlowDay {
  final DateTime date;
  final double balance;

  const CashFlowDay({required this.date, required this.balance});

  factory CashFlowDay.fromJson(Map<String, dynamic> json) => CashFlowDay(
        date: AppFormatters.parseApiDate(json['date'] as String?) ??
            DateTime.now(),
        balance: AppFormatters.toDouble(json['balance']),
      );
}

/// `dashboard/cash-flow-forecast/?days=`.
class CashFlowForecast {
  final int periodDays;
  final double startBalance;
  final double endBalance;
  final List<CashFlowDay> dailyBreakdown;

  const CashFlowForecast({
    required this.periodDays,
    required this.startBalance,
    required this.endBalance,
    required this.dailyBreakdown,
  });

  factory CashFlowForecast.fromJson(Map<String, dynamic> json) =>
      CashFlowForecast(
        periodDays: json['period_days'] as int? ?? 30,
        startBalance: AppFormatters.toDouble(json['start_balance']),
        endBalance: AppFormatters.toDouble(json['end_balance']),
        dailyBreakdown: (json['daily_breakdown'] as List<dynamic>? ?? const [])
            .map((e) => CashFlowDay.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
