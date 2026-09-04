import '../models/menu_option.dart';
import 'base_service.dart';

class MenuOptionsService extends BaseService<MenuOption> {
  MenuOptionsService(super.client)
      : super(
          resourcePath: '/api/v1/personal-planning/menu-options/',
          fromJson: MenuOption.fromJson,
          toJson: (o) => o.toJson(),
        );
}
