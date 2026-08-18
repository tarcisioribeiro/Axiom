/// Mirrors `FoodSerializer` (`apps/api/personal_planning/serializers.py`).
class Food {
  final int id;
  final String uuid;
  final String name;
  final double caloriesPerServing;
  final String? servingSize;
  final String? servingUnit;

  const Food({
    required this.id,
    required this.uuid,
    required this.name,
    required this.caloriesPerServing,
    this.servingSize,
    this.servingUnit,
  });

  factory Food.fromJson(Map<String, dynamic> json) => Food(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        name: json['name'] as String? ?? '',
        caloriesPerServing:
            (json['calories_per_serving'] as num?)?.toDouble() ?? 0,
        servingSize: json['serving_size']?.toString(),
        servingUnit: json['serving_unit'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'calories_per_serving': caloriesPerServing,
        if (servingSize != null) 'serving_size': servingSize,
        if (servingUnit != null) 'serving_unit': servingUnit,
      };
}
