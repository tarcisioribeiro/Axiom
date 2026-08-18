import '../models/meal_type.dart';
import 'base_service.dart';

class MealTypesService extends BaseService<MealType> {
  MealTypesService(super.client)
      : super(
          resourcePath: '/api/v1/personal-planning/meal-types/',
          fromJson: MealType.fromJson,
          toJson: (mealType) => mealType.toJson(),
        );
}
