import '../utils/formatters.dart';

/// One day in the habit consistency heatmap
/// (`personal-planning/routine-tasks/heatmap/`).
class HeatmapDay {
  final DateTime date;
  final int completed;
  final int expected;
  final bool isScheduled;

  const HeatmapDay({
    required this.date,
    required this.completed,
    required this.expected,
    required this.isScheduled,
  });

  /// 0 = nothing scheduled, otherwise completion ratio clamped to [0, 1].
  double get ratio {
    if (expected <= 0) return 0;
    return (completed / expected).clamp(0, 1);
  }

  factory HeatmapDay.fromJson(Map<String, dynamic> json) => HeatmapDay(
        date: AppFormatters.parseApiDate(json['date'] as String?) ??
            DateTime.now(),
        completed: json['completed'] as int? ?? 0,
        expected: json['expected'] as int? ?? 0,
        isScheduled: json['is_scheduled'] as bool? ?? false,
      );
}

class HabitHeatmap {
  final int year;
  final String? taskName;
  final List<HeatmapDay> days;

  const HabitHeatmap({
    required this.year,
    required this.days,
    this.taskName,
  });

  factory HabitHeatmap.fromJson(Map<String, dynamic> json) => HabitHeatmap(
        year: json['year'] as int? ?? DateTime.now().year,
        taskName: json['task_name'] as String?,
        days: ((json['data'] as List?) ?? const [])
            .map((e) => HeatmapDay.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
