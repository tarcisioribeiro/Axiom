import '../models/food.dart';
import 'base_service.dart';

class FoodsService extends BaseService<Food> {
  FoodsService(super.client)
      : super(
          resourcePath: '/api/v1/personal-planning/foods/',
          fromJson: Food.fromJson,
          toJson: (food) => food.toJson(),
        );
}
