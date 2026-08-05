import 'package:dio/dio.dart';

/// No-op on every platform except web — see `browser_credentials_web.dart`
/// (selected via the conditional export in `browser_credentials.dart`).
void enableBrowserCredentials(Dio dio) {}
