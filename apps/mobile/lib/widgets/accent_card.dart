import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import 'app_card.dart';

/// Card with a colored accent strip down one edge, used on list screens to
/// colour-code status (overdue/warning/success). Thin wrapper over [AppCard]
/// — kept as a named widget because the accent-on-a-list-row intent reads
/// better at the call sites than `AppCard(accentColor: ...)`.
class AccentCard extends StatelessWidget {
  final Widget child;
  final Color? accentColor;
  final bool accentOnTop;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;

  const AccentCard({
    super.key,
    required this.child,
    this.accentColor,
    this.accentOnTop = false,
    this.padding = const EdgeInsets.all(AppSpacing.smd),
    this.margin = const EdgeInsets.only(bottom: AppSpacing.sm),
  });

  @override
  Widget build(BuildContext context) {
    return AppCard(
      accentColor: accentColor,
      accentEdge: accentOnTop ? CardAccentEdge.top : CardAccentEdge.left,
      padding: padding,
      margin: margin,
      child: child,
    );
  }
}
