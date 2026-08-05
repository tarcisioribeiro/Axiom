import 'package:dio/browser.dart';
import 'package:dio/dio.dart';

/// The backend's session cookies are httpOnly and cross-origin (the Flutter
/// web app and the Django API run on different ports/hosts in dev), so the
/// browser only attaches/stores them for `fetch`/`XHR` requests made with
/// credentials enabled — the same reason the web frontend sets
/// `withCredentials: true` on its axios instance
/// (`apps/frontend/src/services/api-client.ts`). Dio's browser adapter
/// defaults this to `false`.
void enableBrowserCredentials(Dio dio) {
  final adapter = dio.httpClientAdapter;
  if (adapter is BrowserHttpClientAdapter) {
    adapter.withCredentials = true;
  }
}
