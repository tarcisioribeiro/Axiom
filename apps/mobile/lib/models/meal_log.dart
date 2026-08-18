import '../utils/formatters.dart';

/// Mirrors the subset of `MealLogSerializer`
/// (`apps/api/personal_planning/serializers.py`) the mobile quick-log form
/// needs. `menuOption` (a specific dish within a meal type) is left off —
/// the mobile app only logs "free meals" against a [MealType] (see
/// `documentation/mobile/README.md`).
class MealLog {
  final int id;
  final String uuid;
  final int mealType;
  final String? mealTypeName;
  final bool isFreeMeal;
  final DateTime date;
  final String? notes;

  const MealLog({
    required this.id,
    required this.uuid,
    required this.mealType,
    required this.isFreeMeal,
    required this.date,
    this.mealTypeName,
    this.notes,
  });

  factory MealLog.fromJson(Map<String, dynamic> json) => MealLog(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        mealType: json['meal_type'] as int,
        mealTypeName: json['meal_type_name'] as String?,
        isFreeMeal: json['is_free_meal'] as bool? ?? true,
        date: AppFormatters.parseApiDate(json['date'] as String?) ??
            DateTime.now(),
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'meal_type': mealType,
        'is_free_meal': isFreeMeal,
        'date': AppFormatters.apiDate(date),
        if (notes != null) 'notes': notes,
      };
}
