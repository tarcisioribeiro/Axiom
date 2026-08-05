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
        levelProgressPct: (json['level_progress_pct'] as num?)?.toDouble() ?? 0,
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

  const PlanningStats({
    required this.totalTasks,
    required this.activeTasks,
    required this.totalGoals,
    required this.activeGoals,
    required this.completedGoals,
    required this.completionRate7d,
  });

  factory PlanningStats.fromJson(Map<String, dynamic> json) => PlanningStats(
        totalTasks: json['total_tasks'] as int? ?? 0,
        activeTasks: json['active_tasks'] as int? ?? 0,
        totalGoals: json['total_goals'] as int? ?? 0,
        activeGoals: json['active_goals'] as int? ?? 0,
        completedGoals: json['completed_goals'] as int? ?? 0,
        completionRate7d: (json['completion_rate_7d'] as num?)?.toDouble() ?? 0,
      );
}
