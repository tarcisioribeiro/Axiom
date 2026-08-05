/// Mirrors `ExerciseSerializer` (`apps/api/personal_planning/serializers.py`)
/// — the reusable exercise catalog entries.
class ExerciseCatalog {
  final int id;
  final String uuid;
  final String name;
  final String? muscleGroups;
  final String? description;

  const ExerciseCatalog({
    required this.id,
    required this.uuid,
    required this.name,
    this.muscleGroups,
    this.description,
  });

  factory ExerciseCatalog.fromJson(Map<String, dynamic> json) =>
      ExerciseCatalog(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        name: json['name'] as String? ?? '',
        muscleGroups: json['muscle_groups'] as String?,
        description: json['description'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        if (muscleGroups != null) 'muscle_groups': muscleGroups,
        if (description != null) 'description': description,
      };
}
