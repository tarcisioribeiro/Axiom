import '../utils/formatters.dart';

/// Models for the "Wellness Center" (`personal-planning/wellness/*`).

class EmotionalCheckin {
  final int id;
  final DateTime checkedAt;
  final int loneliness;
  final int neediness;
  final int anxiety;
  final int sadness;
  final int motivation;
  final int energy;
  final String? whatHappened;
  final String? occupyingThoughts;

  const EmotionalCheckin({
    required this.id,
    required this.checkedAt,
    required this.loneliness,
    required this.neediness,
    required this.anxiety,
    required this.sadness,
    required this.motivation,
    required this.energy,
    this.whatHappened,
    this.occupyingThoughts,
  });

  factory EmotionalCheckin.fromJson(Map<String, dynamic> json) =>
      EmotionalCheckin(
        id: json['id'] as int,
        checkedAt: AppFormatters.parseApiDate(json['checked_at'] as String?) ??
            DateTime.now(),
        loneliness: json['loneliness'] as int? ?? 0,
        neediness: json['neediness'] as int? ?? 0,
        anxiety: json['anxiety'] as int? ?? 0,
        sadness: json['sadness'] as int? ?? 0,
        motivation: json['motivation'] as int? ?? 5,
        energy: json['energy'] as int? ?? 5,
        whatHappened: json['what_happened'] as String?,
        occupyingThoughts: json['occupying_thoughts'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'checked_at': AppFormatters.apiDate(checkedAt),
        'loneliness': loneliness,
        'neediness': neediness,
        'anxiety': anxiety,
        'sadness': sadness,
        'motivation': motivation,
        'energy': energy,
        if (whatHappened != null && whatHappened!.isNotEmpty)
          'what_happened': whatHappened,
        if (occupyingThoughts != null && occupyingThoughts!.isNotEmpty)
          'occupying_thoughts': occupyingThoughts,
      };
}

class CrisisImpulseLog {
  final int id;
  final DateTime loggedAt;
  final String emotionalState;
  final String? emotionalStateDisplay;
  final String? emotionalStateOther;
  final String impulseType;
  final String? impulseTypeDisplay;
  final String? impulseTypeOther;
  final String? aiResponse; // raw JSON string
  final bool resolved;

  const CrisisImpulseLog({
    required this.id,
    required this.loggedAt,
    required this.emotionalState,
    required this.impulseType,
    required this.resolved,
    this.emotionalStateDisplay,
    this.emotionalStateOther,
    this.impulseTypeDisplay,
    this.impulseTypeOther,
    this.aiResponse,
  });

  factory CrisisImpulseLog.fromJson(Map<String, dynamic> json) =>
      CrisisImpulseLog(
        id: json['id'] as int,
        loggedAt: DateTime.tryParse(json['logged_at'] as String? ?? '') ??
            DateTime.now(),
        emotionalState: json['emotional_state'] as String? ?? 'other',
        emotionalStateDisplay: json['emotional_state_display'] as String?,
        emotionalStateOther: json['emotional_state_other'] as String?,
        impulseType: json['impulse_type'] as String? ?? 'other',
        impulseTypeDisplay: json['impulse_type_display'] as String?,
        impulseTypeOther: json['impulse_type_other'] as String?,
        aiResponse: json['ai_response'] as String?,
        resolved: json['resolved'] as bool? ?? false,
      );
}

/// Parsed shape of [CrisisImpulseLog.aiResponse].
class CrisisAiResponse {
  final String validation;
  final String explanation;
  final Map<String, List<String>> actionPlan;
  final String affirmation;

  const CrisisAiResponse({
    required this.validation,
    required this.explanation,
    required this.actionPlan,
    required this.affirmation,
  });

  static CrisisAiResponse? tryParse(Object? decoded) {
    if (decoded is! Map) return null;
    final plan = <String, List<String>>{};
    final rawPlan = decoded['action_plan'];
    if (rawPlan is Map) {
      rawPlan.forEach((k, v) {
        plan['$k'] = (v as List? ?? const []).map((e) => '$e').toList();
      });
    }
    return CrisisAiResponse(
      validation: decoded['validation']?.toString() ?? '',
      explanation: decoded['explanation']?.toString() ?? '',
      actionPlan: plan,
      affirmation: decoded['affirmation']?.toString() ?? '',
    );
  }
}

class WellnessIntervention {
  final int id;
  final String title;
  final String? description;
  final String category;
  final String? categoryDisplay;
  final int? durationMinutes;
  final String difficulty;
  final String? difficultyDisplay;
  final String? expectedBenefit;

  const WellnessIntervention({
    required this.id,
    required this.title,
    required this.category,
    required this.difficulty,
    this.description,
    this.categoryDisplay,
    this.durationMinutes,
    this.difficultyDisplay,
    this.expectedBenefit,
  });

  factory WellnessIntervention.fromJson(Map<String, dynamic> json) =>
      WellnessIntervention(
        id: json['id'] as int,
        title: json['title'] as String? ?? '',
        description: json['description'] as String?,
        category: json['category'] as String? ?? '',
        categoryDisplay: json['category_display'] as String?,
        durationMinutes: json['duration_minutes'] as int?,
        difficulty: json['difficulty'] as String? ?? 'easy',
        difficultyDisplay: json['difficulty_display'] as String?,
        expectedBenefit: json['expected_benefit'] as String?,
      );
}

class WellnessWeeklyReport {
  final int id;
  final DateTime? weekStart;
  final DateTime? weekEnd;
  final String? aiSummary;
  final List<String> attentionPoints;
  final List<String> suggestions;
  final double? avgLoneliness;
  final double? avgAnxiety;
  final double? avgMotivation;
  final int? latestSelfEsteemScore;

  const WellnessWeeklyReport({
    required this.id,
    required this.attentionPoints,
    required this.suggestions,
    this.weekStart,
    this.weekEnd,
    this.aiSummary,
    this.avgLoneliness,
    this.avgAnxiety,
    this.avgMotivation,
    this.latestSelfEsteemScore,
  });

  factory WellnessWeeklyReport.fromJson(Map<String, dynamic> json) =>
      WellnessWeeklyReport(
        id: json['id'] as int,
        weekStart: AppFormatters.parseApiDate(json['week_start'] as String?),
        weekEnd: AppFormatters.parseApiDate(json['week_end'] as String?),
        aiSummary: json['ai_summary'] as String?,
        attentionPoints: ((json['attention_points'] as List?) ?? const [])
            .map((e) => '$e')
            .toList(),
        suggestions: ((json['suggestions'] as List?) ?? const [])
            .map((e) => '$e')
            .toList(),
        avgLoneliness: json['avg_loneliness'] == null
            ? null
            : AppFormatters.toDouble(json['avg_loneliness']),
        avgAnxiety: json['avg_anxiety'] == null
            ? null
            : AppFormatters.toDouble(json['avg_anxiety']),
        avgMotivation: json['avg_motivation'] == null
            ? null
            : AppFormatters.toDouble(json['avg_motivation']),
        latestSelfEsteemScore: json['latest_self_esteem_score'] as int?,
      );
}

/// Aggregate of `wellness/dashboard/`.
class WellnessDashboard {
  final int? selfEsteemScore;
  final double? selfEsteemWeekAvg;
  final double? avgLoneliness;
  final double? avgAnxiety;
  final double? avgMotivation;
  final double? avgEnergy;
  final int checkinsThisWeek;
  final int impulsesThisWeek;
  final int impulsesResolvedThisWeek;
  final int interventionsThisWeek;

  const WellnessDashboard({
    required this.checkinsThisWeek,
    required this.impulsesThisWeek,
    required this.impulsesResolvedThisWeek,
    required this.interventionsThisWeek,
    this.selfEsteemScore,
    this.selfEsteemWeekAvg,
    this.avgLoneliness,
    this.avgAnxiety,
    this.avgMotivation,
    this.avgEnergy,
  });

  factory WellnessDashboard.fromJson(Map<String, dynamic> json) {
    final se = json['self_esteem'] as Map<String, dynamic>? ?? const {};
    final emo = json['emotional'] as Map<String, dynamic>? ?? const {};
    final imp = json['impulses'] as Map<String, dynamic>? ?? const {};
    final inter = json['interventions'] as Map<String, dynamic>? ?? const {};
    double? d(Object? v) => v == null ? null : AppFormatters.toDouble(v);
    return WellnessDashboard(
      selfEsteemScore: se['current_score'] as int?,
      selfEsteemWeekAvg: d(se['week_avg']),
      avgLoneliness: d(emo['avg_loneliness']),
      avgAnxiety: d(emo['avg_anxiety']),
      avgMotivation: d(emo['avg_motivation']),
      avgEnergy: d(emo['avg_energy']),
      checkinsThisWeek: emo['checkins_this_week'] as int? ?? 0,
      impulsesThisWeek: imp['count_this_week'] as int? ?? 0,
      impulsesResolvedThisWeek: imp['resolved_this_week'] as int? ?? 0,
      interventionsThisWeek: inter['completed_this_week'] as int? ?? 0,
    );
  }
}
