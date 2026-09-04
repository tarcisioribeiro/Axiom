import 'package:flutter/widgets.dart';

/// Border-radius scale for the mobile app.
///
/// The web app's `--radius` is 0.5rem (8px); the mobile values are tuned a
/// step rounder for a more tactile, contemporary feel on touch surfaces
/// (cards, controls, inputs), while the large overlay tier ([xl] + the
/// hand-set 20 on bottom sheets) stays close to Material 3 defaults.
///
/// - [sm]  6  — progress bars, tiny pills, inner chips
/// - [md]  10 — list-row cards, list tiles, compact containers
/// - [lg]  14 — primary cards, buttons, inputs, module tiles
/// - [xl]  20 — dialogs and other large modal surfaces
class AppRadius {
  const AppRadius._();

  static const double sm = 6;
  static const double md = 10;
  static const double lg = 14;
  static const double xl = 20;

  static const BorderRadius smRadius = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius mdRadius = BorderRadius.all(Radius.circular(md));
  static const BorderRadius lgRadius = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius xlRadius = BorderRadius.all(Radius.circular(xl));
}
