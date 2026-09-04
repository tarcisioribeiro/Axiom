import '../utils/formatters.dart';

/// Mirrors the subset of `FinancialGoalSerializer` (`apps/api/vaults/
/// serializers.py`) the mobile screen needs. A goal aggregates one or more
/// cofres and tracks progress toward `targetValue`. `computedProgress` is
/// the category-aware progress the backend calculates.
class FinancialGoal {
  final int id;
  final String uuid;
  final String description;
  final String category;
  final String? categoryDisplay;
  final double targetValue;
  final double currentValue;
  final double progressPercentage;
  final double remainingValue;
  final double? monthlyRequired;
  final int? daysRemaining;
  final DateTime? targetDate;
  final bool isActive;
  final bool isCompleted;
  final int vaultsCount;
  final List<int> vaults;
  final String? notes;

  const FinancialGoal({
    required this.id,
    required this.uuid,
    required this.description,
    required this.category,
    required this.targetValue,
    required this.currentValue,
    required this.progressPercentage,
    required this.remainingValue,
    required this.isActive,
    required this.isCompleted,
    required this.vaultsCount,
    required this.vaults,
    this.categoryDisplay,
    this.monthlyRequired,
    this.daysRemaining,
    this.targetDate,
    this.notes,
  });

  double get progress => (progressPercentage / 100).clamp(0, 1);

  factory FinancialGoal.fromJson(Map<String, dynamic> json) {
    final computed = json['computed_progress'] as Map<String, dynamic>?;
    return FinancialGoal(
      id: json['id'] as int,
      uuid: json['uuid'] as String? ?? '',
      description: json['description'] as String? ?? '',
      category: json['category'] as String? ?? 'savings',
      categoryDisplay: json['category_display'] as String?,
      targetValue: AppFormatters.toDouble(json['target_value']),
      currentValue: AppFormatters.toDouble(
        computed?['current_value'] ?? json['current_value'],
      ),
      progressPercentage: AppFormatters.toDouble(
        computed?['percentage'] ?? json['progress_percentage'],
      ),
      remainingValue: AppFormatters.toDouble(json['remaining_value']),
      monthlyRequired: json['monthly_required'] == null
          ? null
          : AppFormatters.toDouble(json['monthly_required']),
      daysRemaining: json['days_remaining'] as int?,
      targetDate: AppFormatters.parseApiDate(json['target_date'] as String?),
      isActive: json['is_active'] as bool? ?? true,
      isCompleted: json['is_completed'] as bool? ?? false,
      vaultsCount: json['vaults_count'] as int? ??
          (json['vaults'] as List?)?.length ??
          0,
      vaults:
          ((json['vaults'] as List?) ?? const []).map((e) => e as int).toList(),
      notes: json['notes'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'description': description,
        'category': category,
        'target_value': targetValue,
        if (targetDate != null)
          'target_date': AppFormatters.apiDate(targetDate!),
        'is_active': isActive,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}
