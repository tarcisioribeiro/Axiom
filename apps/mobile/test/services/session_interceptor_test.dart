import 'package:axiom_mobile/services/api_client.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fake_dio_adapter.dart';

/// Covers `_SessionInterceptor` (private to `api_client.dart`) through the
/// public `ApiClient` surface: refresh-and-retry on 401, propagating the
/// *original* request's response (not the refresh call's) when refresh
/// fails, request queuing so concurrent 401s only trigger one refresh, and
/// auth endpoints being exempt from the whole flow.
void main() {
  test('200 responses pass through untouched', () async {
    final client = ApiClient.inMemory('http://test');
    client.dio.httpClientAdapter = FakeHttpClientAdapter(
      (options) => jsonResponseBody({'ok': true}),
    );

    final response = await client.dio.get('/api/v1/resource/');

    expect(response.statusCode, 200);
    expect(response.data, {'ok': true});
  });

  test('401 triggers refresh then retries the original request', () async {
    var refreshCalls = 0;
    final client = ApiClient.inMemory('http://test');
    client.dio.httpClientAdapter = FakeHttpClientAdapter((options) {
      if (options.path.contains('authentication/token/refresh/')) {
        refreshCalls++;
        return jsonResponseBody({'refreshed': true});
      }
      final alreadyRetried = options.extra['_sessionRetried'] == true;
      return alreadyRetried
          ? jsonResponseBody({'ok': true})
          : jsonResponseBody({'detail': 'expired'}, statusCode: 401);
    });

    final response = await client.dio.get('/api/v1/resource/');

    expect(refreshCalls, 1);
    expect(response.statusCode, 200);
    expect(response.data, {'ok': true});
  });

  test(
    'failed refresh propagates the original 401, not the refresh response, '
    'and fires onSessionExpired once',
    () async {
      var sessionExpiredCalls = 0;
      final client = ApiClient.inMemory('http://test');
      client.onSessionExpired = () => sessionExpiredCalls++;
      client.dio.httpClientAdapter = FakeHttpClientAdapter((options) {
        if (options.path.contains('authentication/token/refresh/')) {
          return jsonResponseBody({'detail': 'refresh token invalid'},
              statusCode: 401);
        }
        return jsonResponseBody({'detail': 'original failure'},
            statusCode: 401);
      });

      final response = await client.dio.get('/api/v1/resource/');

      expect(sessionExpiredCalls, 1);
      expect(response.statusCode, 401);
      // The caller sees *their* request's error body, not the refresh
      // endpoint's — this is the bug fixed alongside this test.
      expect(response.data, {'detail': 'original failure'});
    },
  );

  test('concurrent 401s share a single refresh call', () async {
    var refreshCalls = 0;
    final client = ApiClient.inMemory('http://test');
    client.dio.httpClientAdapter = FakeHttpClientAdapter((options) {
      if (options.path.contains('authentication/token/refresh/')) {
        refreshCalls++;
        return jsonResponseBody({'refreshed': true});
      }
      final alreadyRetried = options.extra['_sessionRetried'] == true;
      return alreadyRetried
          ? jsonResponseBody({'ok': true})
          : jsonResponseBody({'detail': 'expired'}, statusCode: 401);
    });

    final responses = await Future.wait([
      client.dio.get('/api/v1/resource-a/'),
      client.dio.get('/api/v1/resource-b/'),
    ]);

    expect(refreshCalls, 1);
    expect(responses.every((r) => r.statusCode == 200), isTrue);
  });

  test('auth endpoints never trigger the refresh flow', () async {
    var refreshCalls = 0;
    final client = ApiClient.inMemory('http://test');
    client.dio.httpClientAdapter = FakeHttpClientAdapter((options) {
      if (options.path.contains('authentication/token/refresh/')) {
        refreshCalls++;
      }
      return jsonResponseBody({'detail': 'invalid credentials'},
          statusCode: 401);
    });

    final response = await client.dio.post(
      '/api/v1/authentication/token/',
      data: {'username': 'x', 'password': 'y'},
    );

    expect(refreshCalls, 0);
    expect(response.statusCode, 401);
  });
}
