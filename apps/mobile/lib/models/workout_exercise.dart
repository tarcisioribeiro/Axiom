/// Mirrors `WorkoutExerciseSerializer` (`apps/api/personal_planning/
/// serializers.py`) — one exercise inside a `WorkoutDay`.
class WorkoutExercise {
  final int id;
  final String uuid;
  final int workoutDay;
  final int? exercise; // catalog FK (optional)
  final String? exerciseCatalogName;
  final String name;
  final int sets;
  final int? repsMin;
  final int? repsMax;
  final int? restSeconds;
  final double? load;
  final int order;
  final String? notes;

  const WorkoutExercise({
    required this.id,
    required this.uuid,
    required this.workoutDay,
    required this.name,
    required this.sets,
    required this.order,
    this.exercise,
    this.exerciseCatalogName,
    this.repsMin,
    this.repsMax,
    this.restSeconds,
    this.load,
    this.notes,
  });

  String get repsLabel {
    if (repsMin == null && repsMax == null) return '';
    if (repsMin != null && repsMax != null && repsMin != repsMax) {
      return '$repsMin–$repsMax reps';
    }
    return '${repsMin ?? repsMax} reps';
  }

  factory WorkoutExercise.fromJson(Map<String, dynamic> json) =>
      WorkoutExercise(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        workoutDay: json['workout_day'] as int,
        exercise: json['exercise'] as int?,
        exerciseCatalogName: json['exercise_catalog_name'] as String?,
        name: json['name'] as String? ?? '',
        sets: json['sets'] as int? ?? 0,
        repsMin: json['reps_min'] as int?,
        repsMax: json['reps_max'] as int?,
        restSeconds: json['rest_seconds'] as int?,
        load: json['load'] == null
            ? null
            : double.tryParse(json['load'].toString()),
        order: json['order'] as int? ?? 0,
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'workout_day': workoutDay,
        if (exercise != null) 'exercise': exercise,
        'name': name,
        'sets': sets,
        if (repsMin != null) 'reps_min': repsMin,
        if (repsMax != null) 'reps_max': repsMax,
        if (restSeconds != null) 'rest_seconds': restSeconds,
        if (load != null) 'load': load,
        'order': order,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}
