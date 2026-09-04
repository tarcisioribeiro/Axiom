import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';

/// Where an [AppCard]'s colored accent strip sits, when one is given.
enum CardAccentEdge { left, top }

/// The single surface primitive for the app: a flat, hairline-bordered card
/// on `cardColor`, matching the global `cardTheme`. Replaces ~15 hand-rolled
/// `Container(decoration: BoxDecoration(color: cardColor, border: ...))`
/// blocks that had drifted apart on border weight, radius and padding.
///
/// Pass [accentColor] to get the status strip that the old `AccentCard`
/// provided (overdue/warning/success colour-coding on list rows); pass
/// [onTap] to make the whole card a tap target with a matching ripple.
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final Color? accentColor;
  final CardAccentEdge accentEdge;
  final VoidCallback? onTap;

  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.margin = EdgeInsets.zero,
    this.accentColor,
    this.accentEdge = CardAccentEdge.left,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = accentColor;

    Widget content = Padding(padding: padding, child: child);

    if (accent != null) {
      content = Stack(
        children: [
          content,
          Positioned.fill(
            child: Align(
              alignment: accentEdge == CardAccentEdge.left
                  ? Alignment.centerLeft
                  : Alignment.topCenter,
              child: accentEdge == CardAccentEdge.left
                  ? Container(width: 3, color: accent)
                  : Container(height: 3, color: accent),
            ),
          ),
        ],
      );
    }

    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: AppRadius.lgRadius,
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      clipBehavior: Clip.antiAlias,
      child: onTap == null
          ? content
          : Material(
              type: MaterialType.transparency,
              child: InkWell(onTap: onTap, child: content),
            ),
    );
  }
}
