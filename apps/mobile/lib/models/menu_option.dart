/// Mirrors `MenuOptionSerializer` / `MenuOptionIngredientSerializer`
/// (`apps/api/personal_planning/serializers.py`) — a meal option inside a
/// `MealType`, with its ingredient list.
class MenuOption {
  final int id;
  final String uuid;
  final int mealType;
  final String name;
  final int order;
  final List<MenuOptionIngredient> ingredients;

  const MenuOption({
    required this.id,
    required this.uuid,
    required this.mealType,
    required this.name,
    required this.order,
    required this.ingredients,
  });

  factory MenuOption.fromJson(Map<String, dynamic> json) => MenuOption(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        mealType: json['meal_type'] as int,
        name: json['name'] as String? ?? '',
        order: json['order'] as int? ?? 0,
        ingredients: ((json['ingredients'] as List?) ?? const [])
            .map(
                (e) => MenuOptionIngredient.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'meal_type': mealType,
        'name': name,
        'order': order,
      };
}

class MenuOptionIngredient {
  final int id;
  final int menuOption;
  final int food;
  final String? foodName;
  final double quantity;
  final String unit;
  final String? unitDisplay;
  final bool isOptional;
  final String? notes;

  const MenuOptionIngredient({
    required this.id,
    required this.menuOption,
    required this.food,
    required this.quantity,
    required this.unit,
    required this.isOptional,
    this.foodName,
    this.unitDisplay,
    this.notes,
  });

  factory MenuOptionIngredient.fromJson(Map<String, dynamic> json) =>
      MenuOptionIngredient(
        id: json['id'] as int,
        menuOption: json['menu_option'] as int? ?? 0,
        food: json['food'] as int,
        foodName: json['food_name'] as String?,
        quantity: double.tryParse(json['quantity'].toString()) ?? 0,
        unit: json['unit'] as String? ?? 'g',
        unitDisplay: json['unit_display'] as String?,
        isOptional: json['is_optional'] as bool? ?? false,
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'menu_option': menuOption,
        'food': food,
        'quantity': quantity,
        'unit': unit,
        'is_optional': isOptional,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}
