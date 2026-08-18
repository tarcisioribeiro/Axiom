import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show ChangeNotifier, kIsWeb;
import 'package:shared_preferences/shared_preferences.dart';

/// The two API deployments the mobile app can talk to, matching the
/// environments documented in CLAUDE.md and
/// `documentation/development/dns_infrastructure.md`.
enum ApiEnvironmentType { development, production }

/// The Axiom production hostname (nginx-ingress path-routes `/api` to the
/// Django service on the same origin — see dns_infrastructure.md).
const String kProductionBaseUrl = 'https://axiom.tjtux.duckdns.org';

/// Best-effort default for local Docker dev. Android emulators cannot reach
/// the host machine via `localhost`, and neither can physical devices on the
/// same LAN, so the host machine's LAN IPv4 is used for Android instead; iOS
/// simulators and desktop/web builds can reach the host directly. This
/// address is specific to the current dev machine — override it in the
/// login screen if you're developing from a different host.
const String kDevMachineLanIPv4 = '192.168.2.200';

String defaultDevelopmentBaseUrl() {
  if (kIsWeb) return 'http://localhost:39100';
  try {
    if (Platform.isAndroid) return 'http://$kDevMachineLanIPv4:39100';
  } catch (_) {
    // Platform is unavailable on some non-mobile targets; fall through.
  }
  return 'http://localhost:39100';
}

class ApiEnvironment {
  final ApiEnvironmentType type;
  final String baseUrl;

  const ApiEnvironment({required this.type, required this.baseUrl});

  bool get isProduction => type == ApiEnvironmentType.production;

  String get label =>
      isProduction ? 'Produção (VPS)' : 'Desenvolvimento (Docker local)';
}

/// Persists and exposes which [ApiEnvironment] the app should talk to,
/// plus the editable dev base URL (for emulator vs. physical device vs.
/// desktop testing).
class ApiEnvironmentController extends ChangeNotifier {
  static const _typeKey = 'apiEnvironmentType';
  static const _devUrlKey = 'apiEnvironmentDevUrl';

  ApiEnvironmentType _type = ApiEnvironmentType.development;
  String _devBaseUrl = defaultDevelopmentBaseUrl();

  ApiEnvironmentType get type => _type;
  String get devBaseUrl => _devBaseUrl;

  ApiEnvironment get current => ApiEnvironment(
        type: _type,
        baseUrl: _type == ApiEnvironmentType.production
            ? kProductionBaseUrl
            : _devBaseUrl,
      );

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _type = prefs.getString(_typeKey) == 'production'
        ? ApiEnvironmentType.production
        : ApiEnvironmentType.development;
    _devBaseUrl = prefs.getString(_devUrlKey) ?? defaultDevelopmentBaseUrl();
    notifyListeners();
  }

  Future<void> setType(ApiEnvironmentType type) async {
    _type = type;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _typeKey,
      type == ApiEnvironmentType.production ? 'production' : 'development',
    );
  }

  Future<void> setDevBaseUrl(String url) async {
    _devBaseUrl = url;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_devUrlKey, url);
  }
}
