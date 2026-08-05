import '../models/account.dart';
import 'base_service.dart';

class AccountsService extends BaseService<Account> {
  AccountsService(super.client)
      : super(
          resourcePath: '/api/v1/accounts/',
          fromJson: Account.fromJson,
          toJson: (account) => account.toJson(),
        );
}
