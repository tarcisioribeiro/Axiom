import 'package:axiom_mobile/services/api_client.dart';
import 'package:axiom_mobile/services/base_service.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fake_dio_adapter.dart';

/// Exercises [BaseService.getAll]'s pagination merge — the concurrent
/// page-fetch introduced to replace a page-by-page sequential loop is
/// non-trivial enough (off-by-one risk in `totalPages`, ordering risk from
/// `Future.wait`) to deserve a direct check independent of any screen.
BaseService<Map<String, dynamic>> _serviceForPages(List<List<int>> pages) {
  final client = ApiClient.inMemory('http://test');
  client.dio.httpClientAdapter = FakeHttpClientAdapter((options) {
    final page = int.parse(options.queryParameters['page'].toString());
    final ids = pages[page - 1];
    final totalCount = pages.expand((p) => p).length;
    return jsonResponseBody({
      'count': totalCount,
      'next': page < pages.length ? 'http://test/?page=${page + 1}' : null,
      'previous': null,
      'results': ids.map((id) => {'id': id}).toList(),
    });
  });
  return BaseService<Map<String, dynamic>>(
    client,
    resourcePath: '/items/',
    fromJson: (json) => json,
    toJson: (item) => item,
  );
}

void main() {
  test('single page: returns results without requesting a second page',
      () async {
    final service = _serviceForPages([
      [1, 2, 3],
    ]);

    final items = await service.getAll();

    expect(items.map((i) => i['id']), [1, 2, 3]);
  });

  test('multiple pages: merges results across pages in order', () async {
    final service = _serviceForPages([
      [1, 2],
      [3, 4],
      [5],
    ]);

    final items = await service.getAll();

    expect(items.map((i) => i['id']), [1, 2, 3, 4, 5]);
  });

  test('empty result set: returns an empty list', () async {
    final service = _serviceForPages([[]]);

    final items = await service.getAll();

    expect(items, isEmpty);
  });
}
