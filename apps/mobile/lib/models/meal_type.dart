/// Mirrors `MealTypeSerializer` (`apps/api/personal_planning/serializers.py`).
/// Nested `options`/ingredients editing is deferred past this Tier 1
/// delivery — the mobile app manages meal types themselves and logs meals
/// as "free meals" (see `documentation/mobile/README.md`).
class MealType {
  final int id;
  final String uuid;
  final String name;
  final String? suggestedTime;
  final int order;
  final bool isActive;

  /// Opção usada ao registrar a refeição pela tarefa vinculada;
  /// null = o backend usa a de maior caloria.
  final int? defaultMenuOption;

  const MealType({
    required this.id,
    required this.uuid,
    required this.name,
    required this.order,
    required this.isActive,
    this.suggestedTime,
    this.defaultMenuOption,
  });

  factory MealType.fromJson(Map<String, dynamic> json) => MealType(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        name: json['name'] as String? ?? '',
        suggestedTime: json['suggested_time'] as String?,
        order: json['order'] as int? ?? 0,
        isActive: json['is_active'] as bool? ?? true,
        defaultMenuOption: json['default_menu_option'] as int?,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        if (suggestedTime != null) 'suggested_time': suggestedTime,
        'order': order,
        'is_active': isActive,
        'default_menu_option': defaultMenuOption,
      };
}
