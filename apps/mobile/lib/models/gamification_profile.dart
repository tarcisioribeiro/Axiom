import '../utils/formatters.dart';

/// Mirrors `personal-planning/gamification/` — level/XP/streak summary
/// shown on the planning dashboard.
class GamificationProfile {
  final int totalXp;
  final int currentLevel;
  final int currentStreak;
  final int longestStreak;
  final double levelProgressPct;

  const GamificationProfile({
    required this.totalXp,
    required this.currentLevel,
    required this.currentStreak,
    required this.longestStreak,
    required this.levelProgressPct,
  });

  factory GamificationProfile.fromJson(Map<String, dynamic> json) =>
      GamificationProfile(
        totalXp: json['total_xp'] as int? ?? 0,
        currentLevel: json['current_level'] as int? ?? 1,
        currentStreak: json['current_streak'] as int? ?? 0,
        longestStreak: json['longest_streak'] as int? ?? 0,
        levelProgressPct: AppFormatters.toDouble(json['level_progress_pct']),
      );
}

/// Mirrors `personal-planning/dashboard/stats/` — the mobile planning
/// dashboard's headline numbers.
class PlanningStats {
  final int totalTasks;
  final int activeTasks;
  final int totalGoals;
  final int activeGoals;
  final int completedGoals;
  final double completionRate7d;
  final int currentStreak;
  final int bestStreak;
  final int totalTasksToday;
  final int completedTasksToday;

  /// `{date, total, completed, rate}` for the last 7 days.
  final List<({DateTime date, int completed, double rate})> weeklyProgress;

  /// Top 5 active-task categories.
  final List<({String category, String label, int count})> tasksByCategory;

  final List<({String title, double progress})> activeGoalsProgress;

  const PlanningStats({
    required this.totalTasks,
    required this.activeTasks,
    required this.totalGoals,
    required this.activeGoals,
    required this.completedGoals,
    required this.completionRate7d,
    this.currentStreak = 0,
    this.bestStreak = 0,
    this.totalTasksToday = 0,
    this.completedTasksToday = 0,
    this.weeklyProgress = const [],
    this.tasksByCategory = const [],
    this.activeGoalsProgress = const [],
  });

  factory PlanningStats.fromJson(Map<String, dynamic> json) {
    List<Map<String, dynamic>> list(String key) =>
        (json[key] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();
    return PlanningStats(
      totalTasks: json['total_tasks'] as int? ?? 0,
      activeTasks: json['active_tasks'] as int? ?? 0,
      totalGoals: json['total_goals'] as int? ?? 0,
      activeGoals: json['active_goals'] as int? ?? 0,
      completedGoals: json['completed_goals'] as int? ?? 0,
      completionRate7d: AppFormatters.toDouble(json['completion_rate_7d']),
      currentStreak: json['current_streak'] as int? ?? 0,
      bestStreak: json['best_streak'] as int? ?? 0,
      totalTasksToday: json['total_tasks_today'] as int? ?? 0,
      completedTasksToday: json['completed_tasks_today'] as int? ?? 0,
      weeklyProgress: [
        for (final d in list('weekly_progress'))
          (
            date: AppFormatters.parseApiDate(d['date'] as String?) ??
                DateTime.now(),
            completed: d['completed'] as int? ?? 0,
            rate: AppFormatters.toDouble(d['rate']),
          ),
      ],
      tasksByCategory: [
        for (final c in list('tasks_by_category'))
          (
            category: c['category'] as String? ?? 'other',
            label: c['category_display'] as String? ??
                c['category'] as String? ??
                '',
            count: c['count'] as int? ?? 0,
          ),
      ],
      activeGoalsProgress: [
        for (final g in list('active_goals_progress'))
          (
            title: g['title'] as String? ?? '',
            progress: AppFormatters.toDouble(g['progress_percentage']),
          ),
      ],
    );
  }
}
