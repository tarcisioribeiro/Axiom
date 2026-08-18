import '../utils/formatters.dart';

/// Mirrors the subset of `GoalSerializer`
/// (`apps/api/personal_planning/serializers.py`) the mobile quick-entry
/// form needs. `goalSource`/`relatedTask` (auto-tracked goals fed by task
/// instances/workout sessions/meal logs) are read-only server concerns —
/// the mobile form only creates `custom` goals with a manually-updated
/// `currentValue`.
class Goal {
  final int id;
  final String uuid;
  final String title;
  final String? description;
  final String goalType;
  final double targetValue;
  final double currentValue;
  final DateTime startDate;
  final DateTime? endDate;
  final String status;
  final double progressPercentage;

  const Goal({
    required this.id,
    required this.uuid,
    required this.title,
    required this.goalType,
    required this.targetValue,
    required this.currentValue,
    required this.startDate,
    required this.status,
    required this.progressPercentage,
    this.description,
    this.endDate,
  });

  factory Goal.fromJson(Map<String, dynamic> json) => Goal(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        title: json['title'] as String? ?? '',
        description: json['description'] as String?,
        goalType: json['goal_type'] as String? ?? 'custom',
        targetValue: AppFormatters.toDouble(json['target_value']),
        currentValue: AppFormatters.toDouble(
          json['calculated_current_value'] ?? json['current_value'],
        ),
        startDate: AppFormatters.parseApiDate(json['start_date'] as String?) ??
            DateTime.now(),
        endDate: AppFormatters.parseApiDate(json['end_date'] as String?),
        status: json['status'] as String? ?? 'active',
        progressPercentage: AppFormatters.toDouble(json['progress_percentage']),
      );

  Map<String, dynamic> toJson() => {
        'title': title,
        if (description != null) 'description': description,
        'goal_type': goalType,
        'goal_source': 'custom',
        'target_value': targetValue,
        'current_value': currentValue,
        'start_date': AppFormatters.apiDate(startDate),
        if (endDate != null) 'end_date': AppFormatters.apiDate(endDate!),
      };
}
