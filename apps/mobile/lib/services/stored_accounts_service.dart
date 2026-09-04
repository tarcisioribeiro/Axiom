import '../models/stored_account.dart';
import 'base_service.dart';

class StoredAccountsService extends BaseService<StoredAccount> {
  StoredAccountsService(super.client)
      : super(
          resourcePath: '/api/v1/security/stored-accounts/',
          fromJson: StoredAccount.fromJson,
          toJson: (a) => a.toJson(),
        );

  Future<StoredAccountReveal> reveal(int id) =>
      _revealAt('$resourcePath$id/reveal/');

  /// Like [reveal] but hits `/copy/` so the audit log records a "copy".
  Future<StoredAccountReveal> copy(int id) =>
      _revealAt('$resourcePath$id/copy/');

  Future<void> toggleFavorite(int id) async {
    final response = await client.dio
        .post<Map<String, dynamic>>('$resourcePath$id/favorite/');
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
  }

  Future<StoredAccountReveal> _revealAt(String path) async {
    final response = await client.dio.get<Map<String, dynamic>>(path);
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
    return StoredAccountReveal.fromJson(response.data!);
  }
}
