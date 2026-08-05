import '../utils/formatters.dart';

/// Mirrors `TaskInstanceSerializer`
/// (`apps/api/personal_planning/serializers.py`) — one generated occurrence
/// of a [RoutineTask] for a specific date, the row a checklist screen
/// checks off.
class TaskInstance {
  final int id;
  final String uuid;
  final String taskName;
  final String category;
  final String priority;
  final DateTime scheduledDate;
  final String status;
  final bool isOverdue;
  final String? notes;

  const TaskInstance({
    required this.id,
    required this.uuid,
    required this.taskName,
    required this.category,
    required this.priority,
    required this.scheduledDate,
    required this.status,
    required this.isOverdue,
    this.notes,
  });

  bool get isCompleted => status == 'completed';

  factory TaskInstance.fromJson(Map<String, dynamic> json) => TaskInstance(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        taskName: json['task_name'] as String? ?? '',
        category: json['category'] as String? ?? 'other',
        priority: json['priority'] as String? ?? 'medium',
        scheduledDate:
            AppFormatters.parseApiDate(json['scheduled_date'] as String?) ??
                DateTime.now(),
        status: json['status'] as String? ?? 'pending',
        isOverdue: json['is_overdue'] as bool? ?? false,
        notes: json['notes'] as String?,
      );
}

/// Response of `instances/for-date/` — the instance list plus daily summary
/// counters computed server-side.
class TaskInstancesForDate {
  final List<TaskInstance> instances;
  final int total;
  final int completed;

  const TaskInstancesForDate({
    required this.instances,
    required this.total,
    required this.completed,
  });

  factory TaskInstancesForDate.fromJson(Map<String, dynamic> json) =>
      TaskInstancesForDate(
        instances: (json['instances'] as List<dynamic>? ?? const [])
            .map((e) => TaskInstance.fromJson(e as Map<String, dynamic>))
            .toList(),
        total: json['total'] as int? ?? 0,
        completed: json['completed'] as int? ?? 0,
      );
}
