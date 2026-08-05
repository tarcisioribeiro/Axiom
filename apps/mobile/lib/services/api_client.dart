import 'dart:async';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:path_provider/path_provider.dart';

import 'browser_credentials.dart';

/// Paths that must never trigger the refresh-on-401 flow — hitting them
/// again on failure would either be pointless (they're the ones that
/// establish the session in the first place) or would loop forever.
const List<String> _authEndpointPaths = [
  'authentication/token/',
  'authentication/token/refresh/',
  'users/2fa/verify/',
  'authentication/logout/',
];

/// Thin wrapper around [Dio] configured the same way the web app's
/// `services/api-client.ts` behaves: JWTs live in httpOnly cookies (never
/// read by app code) and are sent automatically on every request. A
/// [PersistCookieJar] keeps the session across app restarts, same as a
/// browser would.
///
/// Also mirrors `api-client.ts`'s 401 refresh-and-retry interceptor: since
/// [BaseOptions.validateStatus] accepts every status below 500, a 401 shows
/// up as a normal [Response] (not a thrown [DioException]), so the retry
/// logic lives in [_SessionInterceptor.onResponse] rather than `onError`.
class ApiClient {
  final Dio dio;
  final CookieJar cookieJar;
  final _SessionInterceptor _sessionInterceptor;

  ApiClient._(this.dio, this.cookieJar, this._sessionInterceptor);

  /// Invoked when a request comes back 401 even after a refresh attempt —
  /// the app should treat this as "the session is gone" and route back to
  /// the login screen.
  set onSessionExpired(void Function()? callback) {
    _sessionInterceptor.onSessionExpired = callback;
  }

  static Future<ApiClient> create(String baseUrl) async {
    final sessionInterceptor = _SessionInterceptor();

    // Flutter Web has no filesystem: `path_provider` has no web
    // implementation at all, and `cookie_jar`'s `FileStorage` needs
    // `dart:io`, which throws the moment it's actually used there — either
    // one left uncaught here would hang `AxiomBootstrap`'s `FutureBuilder`
    // forever on a spinner. The browser manages cookies for XHR/fetch
    // requests itself anyway (see `browser_credentials_web.dart`), so no
    // Dart-side persistence is needed on web in the first place.
    if (kIsWeb) {
      final cookieJar = CookieJar();
      return ApiClient._(
        _buildDio(baseUrl, cookieJar, sessionInterceptor),
        cookieJar,
        sessionInterceptor,
      );
    }

    final supportDir = await getApplicationSupportDirectory();
    final cookieJar = PersistCookieJar(
      ignoreExpires: false,
      storage: FileStorage('${supportDir.path}/.cookies/'),
    );
    return ApiClient._(
      _buildDio(baseUrl, cookieJar, sessionInterceptor),
      cookieJar,
      sessionInterceptor,
    );
  }

  /// Non-persisted variant (no `path_provider` platform channel involved) —
  /// used by widget tests, where a real file-backed cookie jar isn't
  /// available.
  factory ApiClient.inMemory(String baseUrl) {
    final cookieJar = CookieJar();
    final sessionInterceptor = _SessionInterceptor();
    return ApiClient._(
      _buildDio(baseUrl, cookieJar, sessionInterceptor),
      cookieJar,
      sessionInterceptor,
    );
  }

  static Dio _buildDio(
    String baseUrl,
    CookieJar cookieJar,
    _SessionInterceptor sessionInterceptor,
  ) {
    final dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: const {'Content-Type': 'application/json'},
        // Let callers inspect 4xx bodies (e.g. login errors, 423 vault-locked)
        // instead of Dio throwing before the response is readable.
        validateStatus: (status) => status != null && status < 500,
      ),
    );
    // `CookieManager` asserts `!kIsWeb` internally ("Don't use the manager
    // on Web environments.") — on web the browser attaches/stores cookies
    // for XHR/fetch itself once credentials are enabled, so the Dart-side
    // jar is neither usable nor needed there.
    if (!kIsWeb) {
      dio.interceptors.add(CookieManager(cookieJar));
    }
    sessionInterceptor.dio = dio;
    dio.interceptors.add(sessionInterceptor);
    enableBrowserCredentials(dio);
    return dio;
  }

  void updateBaseUrl(String baseUrl) {
    dio.options.baseUrl = baseUrl;
  }

  Future<void> clearSession() => cookieJar.deleteAll();
}

/// Refresh-on-401 with request queuing, mirroring
/// `apps/frontend/src/services/api-client.ts`'s axios interceptor.
class _SessionInterceptor extends Interceptor {
  late Dio dio;
  void Function()? onSessionExpired;

  bool _isRefreshing = false;
  final List<Completer<void>> _refreshWaiters = [];

  bool _isAuthEndpoint(String path) =>
      _authEndpointPaths.any((endpoint) => path.contains(endpoint));

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final options = response.requestOptions;
    final alreadyRetried = options.extra['_sessionRetried'] == true;

    if (response.statusCode != 401 ||
        alreadyRetried ||
        _isAuthEndpoint(options.path)) {
      handler.next(response);
      return;
    }

    _retryAfterRefresh(options, handler);
  }

  Future<void> _retryAfterRefresh(
    RequestOptions options,
    ResponseInterceptorHandler handler,
  ) async {
    if (_isRefreshing) {
      final waiter = Completer<void>();
      _refreshWaiters.add(waiter);
      await waiter.future;
    } else {
      _isRefreshing = true;
      try {
        final refreshResponse = await dio.post(
          '/api/v1/authentication/token/refresh/',
          options: Options(extra: {'_sessionRetried': true}),
        );
        if (refreshResponse.statusCode != 200) {
          onSessionExpired?.call();
          handler.next(refreshResponse);
          _isRefreshing = false;
          _releaseWaiters();
          return;
        }
      } on DioException {
        onSessionExpired?.call();
        _isRefreshing = false;
        _releaseWaiters();
        handler.next(
          Response(
            requestOptions: options,
            statusCode: 401,
            statusMessage: 'Sessão expirada',
          ),
        );
        return;
      }
      _isRefreshing = false;
      _releaseWaiters();
    }

    options.extra['_sessionRetried'] = true;
    try {
      final retried = await dio.fetch(options);
      handler.resolve(retried);
    } on DioException catch (e) {
      handler.reject(e);
    }
  }

  void _releaseWaiters() {
    for (final waiter in _refreshWaiters) {
      if (!waiter.isCompleted) waiter.complete();
    }
    _refreshWaiters.clear();
  }
}
