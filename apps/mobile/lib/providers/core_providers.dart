import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/api_environment.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../services/session_controller.dart';
import '../theme/theme_controller.dart';

/// These four are overridden once at bootstrap (`main.dart`), after the
/// async setup (theme/environment load, cookie-jar-backed [ApiClient],
/// initial session check) resolves. Every other provider in the app derives
/// from them, so screens never construct services/controllers themselves.
final apiClientProvider = Provider<ApiClient>((ref) {
  throw UnimplementedError('apiClientProvider must be overridden at bootstrap');
});

final themeControllerProvider = ChangeNotifierProvider<ThemeController>((ref) {
  throw UnimplementedError(
    'themeControllerProvider must be overridden at bootstrap',
  );
});

final environmentControllerProvider =
    ChangeNotifierProvider<ApiEnvironmentController>((ref) {
  throw UnimplementedError(
    'environmentControllerProvider must be overridden at bootstrap',
  );
});

final sessionControllerProvider =
    ChangeNotifierProvider<SessionController>((ref) {
  throw UnimplementedError(
    'sessionControllerProvider must be overridden at bootstrap',
  );
});

final authServiceProvider = Provider<AuthService>(
  (ref) => AuthService(ref.watch(apiClientProvider)),
);
