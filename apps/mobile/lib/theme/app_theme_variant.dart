import 'package:flutter/material.dart';

import 'app_palette_tokens.dart';
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

  /// Semantic tokens the web layers on top of the palette (`--muted-*`,
  /// `--border-subtle`, `--input`, `--star`, `--category-*`).
  AppPaletteTokens get tokens => kPaletteTokens[id]!;

  /// `--muted-foreground`: secondary text / icons.
  Color get _muted => tokens.mutedForeground;

  /// Web cards/inputs use `border-border/70`; flattened onto the background
  /// so it can also serve as an opaque divider color.
  Color get _hairline => Color.lerp(background, border, 0.7)!;

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
        tokens,
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
      dividerTheme: DividerThemeData(
        color: tokens.borderSubtle,
        thickness: 1,
        space: 1,
      ),
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
        border: inputBorder(hairline),
        enabledBorder: inputBorder(hairline),
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

/// Web tokens that sit on top of each palette, transcribed per theme into
/// `app_palette_tokens.dart` (generated). The `category-*` colors identify
/// modules: finance → Finanças, health → Planejamento, exercise → Treino,
/// nutrition → Nutrição, intellect → Biblioteca, studies → Segurança.
/// Look up via `context.palette`.
class AppPaletteTokens extends ThemeExtension<AppPaletteTokens> {
  final Color muted;
  final Color mutedForeground;
  final Color borderSubtle;
  final Color input;
  final Color star;
  final Color finance;
  final Color health;
  final Color studies;
  final Color spiritual;
  final Color exercise;
  final Color nutrition;
  final Color work;
  final Color leisure;
  final Color intellect;

  const AppPaletteTokens({
    required this.muted,
    required this.mutedForeground,
    required this.borderSubtle,
    required this.input,
    required this.star,
    required this.finance,
    required this.health,
    required this.studies,
    required this.spiritual,
    required this.exercise,
    required this.nutrition,
    required this.work,
    required this.leisure,
    required this.intellect,
  });

  List<Color> get _all => [
        muted,
        mutedForeground,
        borderSubtle,
        input,
        star,
        finance,
        health,
        studies,
        spiritual,
        exercise,
        nutrition,
        work,
        leisure,
        intellect,
      ];

  static AppPaletteTokens _fromList(List<Color> c) => AppPaletteTokens(
        muted: c[0],
        mutedForeground: c[1],
        borderSubtle: c[2],
        input: c[3],
        star: c[4],
        finance: c[5],
        health: c[6],
        studies: c[7],
        spiritual: c[8],
        exercise: c[9],
        nutrition: c[10],
        work: c[11],
        leisure: c[12],
        intellect: c[13],
      );

  @override
  AppPaletteTokens copyWith() => this;

  @override
  AppPaletteTokens lerp(ThemeExtension<AppPaletteTokens>? other, double t) {
    if (other is! AppPaletteTokens) return this;
    final a = _all, b = other._all;
    return _fromList([
      for (var i = 0; i < a.length; i++) Color.lerp(a[i], b[i], t)!,
    ]);
  }
}

extension AppPaletteTokensContext on BuildContext {
  AppPaletteTokens get palette => Theme.of(this).extension<AppPaletteTokens>()!;
}

const String _interFontFamily = 'Inter';

/// Tuned sizes/weights/tracking for the Inter family — Material's stock
/// `Typography.material2021` metrics are built for the default Roboto
/// metrics and read slightly loose with Inter, so weights and letter
/// spacing are adjusted per role for a crisper hierarchy.
///
/// Every role uses tabular figures (`tnum`) so money and metrics line up and
/// counters don't jitter — the web applies `.numeric` (`tabular-nums`) to
/// values; doing it globally covers every amount on screen.
const _tnum = [FontFeature.tabularFigures()];

const TextTheme _interTextTheme = TextTheme(
  displayLarge: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 57,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.25,
  ),
  displayMedium: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 45,
    fontWeight: FontWeight.w700,
  ),
  displaySmall: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 36,
    fontWeight: FontWeight.w600,
  ),
  headlineLarge: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 32,
    fontWeight: FontWeight.w700,
  ),
  headlineMedium: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.1,
  ),
  headlineSmall: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 24,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
  ),
  titleLarge: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 22,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.1,
  ),
  titleMedium: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 16,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
  ),
  titleSmall: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
  ),
  bodyLarge: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 16,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.15,
    height: 1.4,
  ),
  bodyMedium: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 14,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.15,
    height: 1.4,
  ),
  bodySmall: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 12,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.2,
    height: 1.35,
  ),
  labelLarge: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
  ),
  labelMedium: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
    fontSize: 12,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.3,
  ),
  labelSmall: TextStyle(
    fontFamily: _interFontFamily,
    fontFeatures: _tnum,
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
