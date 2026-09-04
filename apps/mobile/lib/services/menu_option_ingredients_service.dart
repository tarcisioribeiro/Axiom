import '../models/menu_option.dart';
import 'base_service.dart';

class MenuOptionIngredientsService extends BaseService<MenuOptionIngredient> {
  MenuOptionIngredientsService(super.client)
      : super(
          resourcePath: '/api/v1/personal-planning/menu-option-ingredients/',
          fromJson: MenuOptionIngredient.fromJson,
          toJson: (i) => i.toJson(),
        );
}
