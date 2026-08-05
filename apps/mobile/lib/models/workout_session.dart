import '../utils/formatters.dart';

/// Mirrors the subset of `WorkoutSessionSerializer`
/// (`apps/api/personal_planning/serializers.py`) the mobile quick-log form
/// needs — a freeform ("avulso", `workout_day == null`) session log rather
/// than the full set-by-set tracking the web app supports.
class WorkoutSession {
  final int id;
  final String uuid;
  final DateTime date;
  final String? workoutDayName;
  final String? notes;

  const WorkoutSession({
    required this.id,
    required this.uuid,
    required this.date,
    this.workoutDayName,
    this.notes,
  });

  factory WorkoutSession.fromJson(Map<String, dynamic> json) => WorkoutSession(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        date: AppFormatters.parseApiDate(json['date'] as String?) ??
            DateTime.now(),
        workoutDayName: json['workout_day_name'] as String?,
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'date': AppFormatters.apiDate(date),
        if (notes != null) 'notes': notes,
      };
}
