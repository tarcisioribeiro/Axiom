import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';

/// Card container with a colored accent bar down one edge (left by default),
/// used throughout the list screens to color-code status (overdue/warning/
/// success) — mirrors the web app's `border-l-4` accent pattern.
///
/// Deliberately built as a [Stack] + [Positioned] bar rather than a
/// [BoxDecoration.border] with mixed side colors: Flutter's `Border.paint`
/// throws `A borderRadius can only be given on borders with uniform
/// colors.` as soon as more than one *visible* side color is combined with
/// a `borderRadius` (confirmed by `test/screens/accounts_screen_test.dart`)
/// — the accent side and the plain divider sides are never the same color,
/// so a real [Border] can't express this shape at all.
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
    this.padding = const EdgeInsets.all(AppSpacing.sm),
    this.margin = const EdgeInsets.only(bottom: AppSpacing.sm),
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: AppRadius.mdRadius,
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
      ),
      child: ClipRRect(
        borderRadius: AppRadius.mdRadius,
        child: Stack(
          children: [
            Padding(padding: padding, child: child),
            if (accentColor != null)
              accentOnTop
                  ? Positioned(
                      left: 0,
                      right: 0,
                      top: 0,
                      child: Container(height: 3, color: accentColor),
                    )
                  : Positioned(
                      left: 0,
                      top: 0,
                      bottom: 0,
                      child: Container(width: 4, color: accentColor),
                    ),
          ],
        ),
      ),
    );
  }
}
