/// Mirrors the subset of `RoutineTaskSerializer`
/// (`apps/api/personal_planning/serializers.py`) the mobile quick-entry
/// form needs. Advanced scheduling fields (custom weekdays/month-days,
/// intervals, multiple daily occurrences) are left off — the mobile form
/// only supports the common `daily`/`weekly` periodicities.
class RoutineTask {
  final int id;
  final String uuid;
  final String name;
  final String? description;
  final String category;
  final String periodicity;
  final int? weekday;
  final String priority;
  final bool isActive;
  final double completionRate;

  const RoutineTask({
    required this.id,
    required this.uuid,
    required this.name,
    required this.category,
    required this.periodicity,
    required this.priority,
    required this.isActive,
    required this.completionRate,
    this.description,
    this.weekday,
  });

  factory RoutineTask.fromJson(Map<String, dynamic> json) => RoutineTask(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        category: json['category'] as String? ?? 'other',
        periodicity: json['periodicity'] as String? ?? 'daily',
        weekday: json['weekday'] as int?,
        priority: json['priority'] as String? ?? 'medium',
        isActive: json['is_active'] as bool? ?? true,
        completionRate: (json['completion_rate'] as num?)?.toDouble() ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        if (description != null) 'description': description,
        'category': category,
        'periodicity': periodicity,
        if (periodicity == 'weekly' && weekday != null) 'weekday': weekday,
        'priority': priority,
        'is_active': isActive,
      };
}
