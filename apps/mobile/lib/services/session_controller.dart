import 'package:flutter/foundation.dart';

/// Tracks whether the app currently believes the user has a valid session.
/// Seeded at bootstrap by calling `GET /me/` (so a session persisted from a
/// previous run — the cookie jar survives app restarts — skips the login
/// screen), flipped to `false` either by an explicit logout or by
/// [ApiClient]'s refresh-on-401 flow giving up. Used both as a
/// [ChangeNotifierProvider] (so widgets can `ref.watch` it) and directly as
/// `GoRouter`'s `refreshListenable`, so a session change re-evaluates
/// redirects without any extra plumbing.
class SessionController extends ChangeNotifier {
  bool _isAuthenticated;

  SessionController({required bool isAuthenticated})
      : _isAuthenticated = isAuthenticated;

  bool get isAuthenticated => _isAuthenticated;

  void markAuthenticated() {
    if (_isAuthenticated) return;
    _isAuthenticated = true;
    notifyListeners();
  }

  void markLoggedOut() {
    if (!_isAuthenticated) return;
    _isAuthenticated = false;
    notifyListeners();
  }
}
