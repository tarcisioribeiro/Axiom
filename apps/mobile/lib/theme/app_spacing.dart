/// Spacing scale transcribed from the `--spacing-*` custom properties in
/// `apps/frontend/src/index.css`, so paddings/gaps match the web app's
/// design tokens instead of ad-hoc numeric values.
///
/// [smd] (12) has no direct web token but fills the 8→16 gap that list rows
/// and card internals kept reaching for with hardcoded values.
class AppSpacing {
  const AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double smd = 12;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
}
