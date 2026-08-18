import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_theme_variant.dart';
import 'app_themes.dart';

/// Persists and exposes the active theme variant, mirroring the behavior of
/// `apps/frontend/src/hooks/use-theme.ts` (dark/light mode + per-mode
/// variant, both saved to local storage).
class ThemeController extends ChangeNotifier {
  static const _isDarkKey = 'darkMode';
  static const _darkVariantKey = 'darkVariant';
  static const _lightVariantKey = 'lightVariant';

  bool _isDark = true;
  String _darkVariantId = kDefaultDarkVariantId;
  String _lightVariantId = kDefaultLightVariantId;

  bool get isDark => _isDark;
  String get darkVariantId => _darkVariantId;
  String get lightVariantId => _lightVariantId;

  AppThemeVariant get activeVariant => _isDark
      ? (kDarkVariantsById[_darkVariantId] ?? kDarkVariants.first)
      : (kLightVariantsById[_lightVariantId] ?? kLightVariants.first);

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _isDark = prefs.getBool(_isDarkKey) ?? true;
    _darkVariantId = prefs.getString(_darkVariantKey) ?? kDefaultDarkVariantId;
    _lightVariantId =
        prefs.getString(_lightVariantKey) ?? kDefaultLightVariantId;
    notifyListeners();
  }

  Future<void> toggleMode() async {
    _isDark = !_isDark;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_isDarkKey, _isDark);
  }

  Future<void> selectDarkVariant(String id) async {
    _darkVariantId = id;
    _isDark = true;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_darkVariantKey, id);
    await prefs.setBool(_isDarkKey, true);
  }

  Future<void> selectLightVariant(String id) async {
    _lightVariantId = id;
    _isDark = false;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_lightVariantKey, id);
    await prefs.setBool(_isDarkKey, false);
  }
}
