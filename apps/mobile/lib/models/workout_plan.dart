/// Mirrors `WorkoutPlanSerializer`
/// (`apps/api/personal_planning/serializers.py`). The mobile app manages
/// plans at the top level only — day/exercise editing within a plan is
/// deferred past this Tier 1 delivery (see `documentation/mobile/README.md`).
class WorkoutPlan {
  final int id;
  final String uuid;
  final String name;
  final String? description;
  final bool isActive;
  final int dayCount;
  final int exerciseCount;

  const WorkoutPlan({
    required this.id,
    required this.uuid,
    required this.name,
    required this.isActive,
    required this.dayCount,
    required this.exerciseCount,
    this.description,
  });

  factory WorkoutPlan.fromJson(Map<String, dynamic> json) => WorkoutPlan(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        isActive: json['is_active'] as bool? ?? true,
        dayCount: json['day_count'] as int? ?? 0,
        exerciseCount: json['exercise_count'] as int? ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        if (description != null) 'description': description,
        'is_active': isActive,
      };
}
