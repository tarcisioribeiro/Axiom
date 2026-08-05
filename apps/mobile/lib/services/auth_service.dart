import 'package:dio/dio.dart';

import 'api_client.dart';

enum LoginStatus { success, requiresTwoFactor, error }

class LoginResult {
  final LoginStatus status;
  final String? tempToken;
  final String? errorMessage;

  const LoginResult._(this.status, {this.tempToken, this.errorMessage});

  factory LoginResult.success() => const LoginResult._(LoginStatus.success);

  factory LoginResult.requiresTwoFactor(String tempToken) =>
      LoginResult._(LoginStatus.requiresTwoFactor, tempToken: tempToken);

  factory LoginResult.error(String message) =>
      LoginResult._(LoginStatus.error, errorMessage: message);

  bool get isSuccess => status == LoginStatus.success;
  bool get isTwoFactor => status == LoginStatus.requiresTwoFactor;
}

/// Talks to `authentication/` endpoints exactly like the web app does:
/// login/2FA responses never carry tokens in the body — the backend sets
/// them as httpOnly cookies, which [ApiClient]'s cookie jar attaches to
/// every subsequent request automatically.
class AuthService {
  final ApiClient _client;

  AuthService(this._client);

  Future<LoginResult> login({
    required String username,
    required String password,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/authentication/token/',
        data: {'username': username, 'password': password},
      );

      final data = response.data ?? const {};

      if (response.statusCode == 200) {
        if (data['requires_2fa'] == true) {
          return LoginResult.requiresTwoFactor(data['temp_token'] as String);
        }
        return LoginResult.success();
      }

      return LoginResult.error(_extractErrorMessage(data));
    } on DioException catch (e) {
      return LoginResult.error(_messageForDioException(e));
    }
  }

  Future<LoginResult> verifyTwoFactor({
    required String tempToken,
    required String code,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/users/2fa/verify/',
        data: {'temp_token': tempToken, 'code': code},
      );

      if (response.statusCode == 200) {
        return LoginResult.success();
      }

      return LoginResult.error(_extractErrorMessage(response.data ?? const {}));
    } on DioException catch (e) {
      return LoginResult.error(_messageForDioException(e));
    }
  }

  /// Confirms the session cookies set by [login] are actually valid by
  /// hitting the authenticated `/me/` endpoint, the same way the web app's
  /// axios interceptor implicitly relies on cookie auth for every request.
  Future<bool> fetchCurrentUser() async {
    try {
      final response = await _client.dio.get('/api/v1/me/');
      return response.statusCode == 200;
    } on DioException {
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await _client.dio.post('/api/v1/authentication/logout/');
    } on DioException {
      // Best-effort: clear local cookies regardless of server response.
    }
    await _client.clearSession();
  }

  String _extractErrorMessage(Map<String, dynamic> data) {
    final detail = data['detail'] ?? data['error'] ?? data['message'];
    if (detail is String && detail.isNotEmpty) return detail;
    return 'Usuário ou senha inválidos.';
  }

  String _messageForDioException(DioException e) {
    if (e.response?.data is Map<String, dynamic>) {
      return _extractErrorMessage(e.response!.data as Map<String, dynamic>);
    }
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return 'Tempo de conexão esgotado. Verifique o ambiente selecionado.';
      case DioExceptionType.connectionError:
        return 'Não foi possível conectar ao servidor. Verifique o ambiente selecionado.';
      default:
        return 'Erro inesperado ao conectar ao servidor.';
    }
  }
}
