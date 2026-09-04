import 'package:flutter/material.dart';

import 'app_radius.dart';
import 'app_spacing.dart';

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

  /// Muted foreground for secondary text / icons — derived from the palette
  /// (`foreground` pulled toward `card`) instead of the seed-generated
  /// `onSurfaceVariant`, which drifts off-palette on the community variants.
  Color get _muted => Color.lerp(foreground, card, 0.42)!;

  /// Softer than [border] — used for hairline card outlines / dividers so
  /// they read as a whisper, not a box.
  Color get _hairline => Color.lerp(border, background, 0.4)!;

  /// Subtle fill for inputs / chips: `card` nudged toward `foreground`.
  Color get _faintFill => Color.lerp(card, foreground, isDark ? 0.06 : 0.035)!;

  ColorScheme toColorScheme() {
    return ColorScheme.fromSeed(
      seedColor: primary,
      brightness: isDark ? Brightness.dark : Brightness.light,
    ).copyWith(
      primary: primary,
      onPrimary: onPrimary,
      primaryContainer: Color.lerp(card, primary, 0.28),
      onPrimaryContainer: foreground,
      secondary: secondary,
      onSecondary: onSecondary,
      secondaryContainer: primary.withValues(alpha: 0.16),
      onSecondaryContainer: foreground,
      tertiary: accent,
      onTertiary: onPrimary,
      tertiaryContainer: accent.withValues(alpha: 0.16),
      onTertiaryContainer: foreground,
      surface: background,
      onSurface: foreground,
      onSurfaceVariant: _muted,
      surfaceContainerLowest: Color.lerp(
        background,
        isDark ? const Color(0xFF000000) : const Color(0xFFFFFFFF),
        0.35,
      ),
      surfaceContainerLow: Color.lerp(background, card, 0.5),
      surfaceContainer: card,
      surfaceContainerHigh: Color.lerp(card, foreground, 0.05),
      surfaceContainerHighest: Color.lerp(card, foreground, 0.09),
      error: destructive,
      onError: onPrimary,
      errorContainer: destructive.withValues(alpha: 0.16),
      onErrorContainer: foreground,
      outline: border,
      outlineVariant: _hairline,
      surfaceTint: primary,
      inverseSurface: foreground,
      onInverseSurface: background,
    );
  }

  ThemeData toThemeData() {
    final colorScheme = toColorScheme();
    final textTheme = _interTextTheme.apply(
      bodyColor: foreground,
      displayColor: foreground,
    );
    final muted = _muted;
    final hairline = _hairline;

    OutlineInputBorder inputBorder(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: AppRadius.lgRadius,
          borderSide: width == 0
              ? BorderSide.none
              : BorderSide(color: color, width: width),
        );

    final buttonShape = RoundedRectangleBorder(
      borderRadius: AppRadius.lgRadius,
    );
    const buttonPadding = EdgeInsets.symmetric(
      horizontal: AppSpacing.lg,
      vertical: 14,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: colorScheme.surface,
      cardColor: card,
      // The strong palette tone. Card surfaces use the softer `outlineVariant`
      // hairline (via [AppCard] / [cardTheme]); this stays as the fallback
      // for Material internals that read `dividerColor` directly. Real
      // [Divider]s use the hairline via [dividerTheme] below.
      dividerColor: border,
      fontFamily: _interFontFamily,
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      splashFactory: InkRipple.splashFactory,
      visualDensity: VisualDensity.standard,
      extensions: [
        AppSemanticColors(success: success, warning: warning, info: info),
      ],
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: foreground,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge?.copyWith(color: foreground),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 66,
        backgroundColor: card,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        indicatorColor: primary.withValues(alpha: 0.16),
        indicatorShape: const RoundedRectangleBorder(
          borderRadius: AppRadius.lgRadius,
        ),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 24,
            color: states.contains(WidgetState.selected) ? primary : muted,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => textTheme.labelMedium!.copyWith(
            color: states.contains(WidgetState.selected) ? primary : muted,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.lgRadius,
          side: BorderSide(color: hairline),
        ),
      ),
      dividerTheme: DividerThemeData(color: hairline, thickness: 1, space: 1),
      tabBarTheme: TabBarThemeData(
        labelColor: primary,
        unselectedLabelColor: muted,
        indicatorSize: TabBarIndicatorSize.label,
        indicatorColor: primary,
        dividerColor: hairline,
        labelStyle: textTheme.titleSmall,
        unselectedLabelStyle: textTheme.titleSmall,
        overlayColor: WidgetStatePropertyAll(primary.withValues(alpha: 0.08)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: _faintFill,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 12,
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(color: muted),
        labelStyle: textTheme.bodyMedium?.copyWith(color: muted),
        floatingLabelStyle: textTheme.bodySmall?.copyWith(color: primary),
        prefixIconColor: muted,
        suffixIconColor: muted,
        border: inputBorder(hairline, 0),
        enabledBorder: inputBorder(hairline, 0),
        focusedBorder: inputBorder(primary, 1.5),
        errorBorder: inputBorder(destructive, 1),
        focusedErrorBorder: inputBorder(destructive, 1.5),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          shape: buttonShape,
          padding: buttonPadding,
          textStyle: textTheme.labelLarge,
          minimumSize: const Size(0, 48),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          shape: buttonShape,
          padding: buttonPadding,
          textStyle: textTheme.labelLarge,
          minimumSize: const Size(0, 48),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          shape: buttonShape,
          padding: buttonPadding,
          textStyle: textTheme.labelLarge,
          minimumSize: const Size(0, 48),
          side: BorderSide(color: border),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          shape: buttonShape,
          textStyle: textTheme.labelLarge,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: _faintFill,
        selectedColor: primary.withValues(alpha: 0.16),
        side: BorderSide(color: hairline),
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.mdRadius),
        labelStyle: textTheme.labelMedium?.copyWith(color: foreground),
        secondaryLabelStyle: textTheme.labelMedium?.copyWith(color: foreground),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      ),
      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 2,
        ),
        iconColor: muted,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdRadius),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: primary,
        linearTrackColor: primary.withValues(alpha: 0.15),
        linearMinHeight: 6,
        borderRadius: AppRadius.smRadius,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: card,
        modalBackgroundColor: card,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: muted.withValues(alpha: 0.4),
        shape: const RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: card,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.xlRadius),
        titleTextStyle: textTheme.titleLarge?.copyWith(color: foreground),
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: foreground),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.lgRadius),
        elevation: 2,
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: primary,
        foregroundColor: onPrimary,
        elevation: 2,
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.lgRadius),
      ),
      datePickerTheme: DatePickerThemeData(
        backgroundColor: card,
        surfaceTintColor: Colors.transparent,
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: primary,
        selectionColor: primary.withValues(alpha: 0.24),
        selectionHandleColor: primary,
      ),
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
    letterSpacing: -0.2,
  ),
  titleLarge: TextStyle(
    fontFamily: _interFontFamily,
    fontSize: 22,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.1,
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
