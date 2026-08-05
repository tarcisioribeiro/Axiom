import '../models/password_entry.dart';
import 'base_service.dart';

class PasswordsService extends BaseService<PasswordEntry> {
  PasswordsService(super.client)
      : super(
          resourcePath: '/api/v1/security/passwords/',
          fromJson: PasswordEntry.fromJson,
          toJson: (entry) => entry.toJson(),
        );

  Future<PasswordReveal> reveal(int id) async {
    final response =
        await client.dio.get<Map<String, dynamic>>('$resourcePath$id/reveal/');
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
    return PasswordReveal.fromJson(response.data!);
  }

  /// Same payload as [reveal], but hits the `/copy/` endpoint so the audit
  /// log records a "copy" action instead of a "reveal" — use this when the
  /// password is going straight to the clipboard rather than being shown
  /// on screen.
  Future<PasswordReveal> copy(int id) async {
    final response =
        await client.dio.get<Map<String, dynamic>>('$resourcePath$id/copy/');
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
    return PasswordReveal.fromJson(response.data!);
  }

  /// The endpoint's response shape isn't a full [PasswordEntry] — callers
  /// should invalidate the passwords list provider afterward to pick up
  /// the new `is_favorite` value.
  Future<void> toggleFavorite(int id) async {
    final response = await client.dio
        .post<Map<String, dynamic>>('$resourcePath$id/favorite/');
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
  }
}
