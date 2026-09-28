import '../utils/formatters.dart';

/// Mirrors `HydrationGoalSerializer` — a meta atual (uma por membro).
/// `dailyTargetMl` é null quando o usuário ainda não definiu a meta.
class HydrationGoal {
  final int? id;
  final int? dailyTargetMl;

  const HydrationGoal({this.id, this.dailyTargetMl});

  factory HydrationGoal.fromJson(Map<String, dynamic> json) => HydrationGoal(
        id: json['id'] as int?,
        dailyTargetMl: json['daily_target_ml'] as int?,
      );
}

/// `hydration-goal/suggestion/` — 35 ml/kg + 500 ml por hora de treino.
class HydrationSuggestion {
  final int? suggestedMl;
  final double? weightKg;
  final int? baseMl;
  final int mlPerKg;
  final int trainingDaysPerWeek;
  final int trainingMinutesPerWeek;
  final int exerciseMl;

  const HydrationSuggestion({
    required this.mlPerKg,
    required this.trainingDaysPerWeek,
    required this.trainingMinutesPerWeek,
    required this.exerciseMl,
    this.suggestedMl,
    this.weightKg,
    this.baseMl,
  });

  factory HydrationSuggestion.fromJson(Map<String, dynamic> json) =>
      HydrationSuggestion(
        suggestedMl: json['suggested_ml'] as int?,
        weightKg: json['weight_kg'] == null
            ? null
            : AppFormatters.toDouble(json['weight_kg']),
        baseMl: json['base_ml'] as int?,
        mlPerKg: json['ml_per_kg'] as int? ?? 35,
        trainingDaysPerWeek: json['training_days_per_week'] as int? ?? 0,
        trainingMinutesPerWeek: json['training_minutes_per_week'] as int? ?? 0,
        exerciseMl: json['exercise_ml'] as int? ?? 0,
      );
}

/// Mirrors `WaterLogSerializer`.
class WaterLog {
  final int id;
  final DateTime date;
  final String? time;
  final int amountMl;

  /// true quando o registro veio da conclusão de uma tarefa vinculada.
  final bool fromTask;

  const WaterLog({
    required this.id,
    required this.date,
    required this.amountMl,
    this.time,
    this.fromTask = false,
  });

  factory WaterLog.fromJson(Map<String, dynamic> json) => WaterLog(
        id: json['id'] as int,
        date: AppFormatters.parseApiDate(json['date'] as String?) ??
            DateTime.now(),
        time: json['time'] as String?,
        amountMl: json['amount_ml'] as int? ?? 0,
        fromTask: json['from_task'] as bool? ?? false,
      );
}

/// 1800 → "1,8"
String formatLiters(int ml) {
  final liters = ml / 1000;
  final text = liters.toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '');
  return text.replaceAll('.', ',');
}
