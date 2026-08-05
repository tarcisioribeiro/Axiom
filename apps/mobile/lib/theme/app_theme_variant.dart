import 'package:flutter/material.dart';

/// A single selectable theme variant, mirroring one of the palettes defined
/// in `apps/frontend/src/index.css` (Dracula/Alucard + community variants).
/// Colors here are transcribed from that file's HSL custom properties so the
/// mobile app and the web app render the same palettes.
class AppThemeVariant {
  final String id;
  final String label;
  final bool isDark;
  final Color background;
  final Color foreground;
  final Color card;
  final Color primary;
  final Color onPrimary;
  final Color secondary;
  final Color onSecondary;
  final Color accent;
  final Color destructive;
  final Color success;
  final Color warning;
  final Color info;
  final Color border;

  const AppThemeVariant({
    required this.id,
    required this.label,
    required this.isDark,
    required this.background,
    required this.foreground,
    required this.card,
    required this.primary,
    required this.onPrimary,
    required this.secondary,
    required this.onSecondary,
    required this.accent,
    required this.destructive,
    required this.success,
    required this.warning,
    required this.info,
    required this.border,
  });

  ColorScheme toColorScheme() {
    return ColorScheme.fromSeed(
      seedColor: primary,
      brightness: isDark ? Brightness.dark : Brightness.light,
    ).copyWith(
      primary: primary,
      onPrimary: onPrimary,
      secondary: secondary,
      onSecondary: onSecondary,
      surface: background,
      onSurface: foreground,
      surfaceContainerHighest: card,
      error: destructive,
      onError: onPrimary,
      outline: border,
      tertiary: accent,
    );
  }

  ThemeData toThemeData() {
    final colorScheme = toColorScheme();
    final textTheme = _interTextTheme.apply(
      bodyColor: foreground,
      displayColor: foreground,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: colorScheme.surface,
      cardColor: card,
      dividerColor: border,
      fontFamily: _interFontFamily,
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      extensions: [
        AppSemanticColors(success: success, warning: warning, info: info),
      ],
    );
  }
}

/// Semantic status colors that don't map onto Flutter's [ColorScheme] slots
/// (which only models primary/secondary/tertiary/error) but are used
/// throughout the web app for paid/pending/overdue-style states — StatCards,
/// bill status badges, etc. Look these up via
/// `Theme.of(context).extension<AppSemanticColors>()`.
class AppSemanticColors extends ThemeExtension<AppSemanticColors> {
  final Color success;
  final Color warning;
  final Color info;

  const AppSemanticColors({
    required this.success,
    required this.warning,
    required this.info,
  });

  @override
  AppSemanticColors copyWith({Color? success, Color? warning, Color? info}) {
    return AppSemanticColors(
      success: success ?? this.success,
      warning: warning ?? this.warning,
      info: info ?? this.info,
    );
  }

  @override
  AppSemanticColors lerp(ThemeExtension<AppSemanticColors>? other, double t) {
    if (other is! AppSemanticColors) return this;
    return AppSemanticColors(
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      info: Color.lerp(info, other.info, t)!,
    );
  }
}

const String _interFontFamily = 'Inter';

/// Tuned sizes/weights/tracking for the Inter family — Material's stock
/// `Typography.material2021` metrics are built for the default Roboto
/// metrics and read slightly loose with Inter, so weights and letter
/// spacing are adjusted per role for a crisper hierarchy.
const TextTheme _interTextTheme = TextTheme(
  displayLarge: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 57,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.25,
  ),
  displayMedium: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 45,
    fontWeight: FontWeight.w700,
  ),
  displaySmall: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 36,
    fontWeight: FontWeight.w600,
  ),
  headlineLarge: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 32,
    fontWeight: FontWeight.w700,
  ),
  headlineMedium: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.1,
  ),
  headlineSmall: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 24,
    fontWeight: FontWeight.w600,
  ),
  titleLarge: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 22,
    fontWeight: FontWeight.w600,
  ),
  titleMedium: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 16,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
  ),
  titleSmall: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
  ),
  bodyLarge: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 16,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.15,
    height: 1.4,
  ),
  bodyMedium: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 14,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.15,
    height: 1.4,
  ),
  bodySmall: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 12,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.2,
    height: 1.35,
  ),
  labelLarge: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
  ),
  labelMedium: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 12,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.3,
  ),
  labelSmall: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 11,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.3,
  ),
);

/// Shorthand for `Theme.of(context).extension<AppSemanticColors>()!`.
extension AppSemanticColorsContext on BuildContext {
  AppSemanticColors get semanticColors =>
      Theme.of(this).extension<AppSemanticColors>()!;
}

/// Converts a `hue saturation% lightness%` triple (as used by the CSS
/// custom properties) into a [Color], matching `hsl(var(--token))`.
Color hsl(double hue, double saturationPct, double lightnessPct) {
  return HSLColor.fromAHSL(
    1,
    hue,
    saturationPct / 100,
    lightnessPct / 100,
  ).toColor();
}
