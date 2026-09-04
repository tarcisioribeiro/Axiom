import '../models/stored_card.dart';
import 'base_service.dart';

class StoredCardsService extends BaseService<StoredCard> {
  StoredCardsService(super.client)
      : super(
          resourcePath: '/api/v1/security/stored-cards/',
          fromJson: StoredCard.fromJson,
          toJson: (c) => c.toJson(),
        );

  Future<StoredCardReveal> reveal(int id) =>
      _revealAt('$resourcePath$id/reveal/');

  /// Like [reveal] but hits `/copy/` so the audit log records a "copy".
  Future<StoredCardReveal> copy(int id) => _revealAt('$resourcePath$id/copy/');

  Future<void> toggleFavorite(int id) async {
    final response = await client.dio
        .post<Map<String, dynamic>>('$resourcePath$id/favorite/');
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
  }

  Future<StoredCardReveal> _revealAt(String path) async {
    final response = await client.dio.get<Map<String, dynamic>>(path);
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
    return StoredCardReveal.fromJson(response.data!);
  }
}
