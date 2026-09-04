import 'workout_exercise.dart';

/// Mirrors `WorkoutDaySerializer` (`apps/api/personal_planning/
/// serializers.py`) — one training day inside a `WorkoutPlan`.
class WorkoutDay {
  final int id;
  final String uuid;
  final int plan;
  final String name;
  final String? muscleGroups;
  final int? dayOfWeek;
  final int order;
  final int exerciseCount;
  final List<WorkoutExercise> exercises;

  const WorkoutDay({
    required this.id,
    required this.uuid,
    required this.plan,
    required this.name,
    required this.order,
    required this.exerciseCount,
    required this.exercises,
    this.muscleGroups,
    this.dayOfWeek,
  });

  factory WorkoutDay.fromJson(Map<String, dynamic> json) => WorkoutDay(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        plan: json['plan'] as int,
        name: json['name'] as String? ?? '',
        muscleGroups: json['muscle_groups'] as String?,
        dayOfWeek: json['day_of_week'] as int?,
        order: json['order'] as int? ?? 0,
        exerciseCount: json['exercise_count'] as int? ??
            ((json['exercises'] as List?)?.length ?? 0),
        exercises: ((json['exercises'] as List?) ?? const [])
            .map((e) => WorkoutExercise.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'plan': plan,
        'name': name,
        if (muscleGroups != null) 'muscle_groups': muscleGroups,
        if (dayOfWeek != null) 'day_of_week': dayOfWeek,
        'order': order,
      };
}
