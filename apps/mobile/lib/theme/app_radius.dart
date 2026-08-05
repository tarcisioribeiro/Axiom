import 'package:flutter/widgets.dart';

/// Border-radius scale transcribed from `--radius` (0.5rem) and its `md`/`sm`
/// derivations in `apps/frontend/src/index.css`.
class AppRadius {
  const AppRadius._();

  static const double sm = 4;
  static const double md = 6;
  static const double lg = 8;

  static const BorderRadius smRadius = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius mdRadius = BorderRadius.all(Radius.circular(md));
  static const BorderRadius lgRadius = BorderRadius.all(Radius.circular(lg));
}
