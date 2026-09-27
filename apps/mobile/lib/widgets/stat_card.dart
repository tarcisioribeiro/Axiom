import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/app_theme_variant.dart';
import 'app_card.dart';
import 'motion.dart';

/// Which semantic color tints a [StatCard]'s icon badge and left accent
/// border — mirrors the `accentColor` prop on the web app's `StatCard`.
enum StatAccent { neutral, primary, success, destructive, warning, info }

/// A single trend indicator row (e.g. "+12% vs. mês anterior").
class StatTrend {
  final String label;
  final bool isPositive;

  const StatTrend({required this.label, required this.isPositive});
}

/// Compact metric card — mirrors `components/ui/StatCard` on the web app:
/// small label + tinted icon badge on top, a large value, optional
/// description/trend/progress below, and a colored left accent when set.
class StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final StatAccent accent;
  final String? description;
  final StatTrend? trend;
  final double? progress;
  final bool prominent;

  /// When set (with [format]), the value counts up from 0 to this number
  /// on first build — web `useCounter`. [value] stays the settled text.
  final double? countTo;
  final String Function(double)? format;

  const StatCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    this.accent = StatAccent.neutral,
    this.description,
    this.trend,
    this.progress,
    this.prominent = false,
    this.countTo,
    this.format,
  });

  Color _accentColor(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final semantic = context.semanticColors;
    switch (accent) {
      case StatAccent.neutral:
        return scheme.onSurfaceVariant;
      case StatAccent.primary:
        return scheme.primary;
      case StatAccent.success:
        return semantic.success;
      case StatAccent.destructive:
        return scheme.error;
      case StatAccent.warning:
        return semantic.warning;
      case StatAccent.info:
        return semantic.info;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = _accentColor(context);
    final hasAccent = accent != StatAccent.neutral;

    final valueStyle =
        (prominent ? theme.textTheme.headlineSmall : theme.textTheme.titleLarge)
            ?.copyWith(
      fontWeight: FontWeight.w700,
      color: hasAccent ? color : null,
    );
    Widget valueText(String text) => Text(
          text,
          style: valueStyle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        );

    return Semantics(
      container: true,
      label: [title, value, if (description != null) description!].join(', '),
      excludeSemantics: true,
      child: AppCard(
        accentColor: hasAccent ? color : null,
        tinted: hasAccent,
        padding: EdgeInsets.fromLTRB(
          AppSpacing.md + (hasAccent ? AppSpacing.xs : 0),
          AppSpacing.md,
          AppSpacing.md,
          AppSpacing.md,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: AppRadius.mdRadius,
                    border: Border.all(color: color.withValues(alpha: 0.2)),
                  ),
                  child: Icon(icon, size: 18, color: color),
                ),
              ],
            ),
            SizedBox(height: AppSpacing.sm),
            if (countTo != null && format != null)
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: countTo),
                duration: AppMotion.of(context, AppMotion.slow),
                curve: AppMotion.easeOut,
                builder: (context, v, _) =>
                    valueText(v == countTo ? value : format!(v)),
              )
            else
              valueText(value),
            if (description != null) ...[
              SizedBox(height: AppSpacing.xs),
              Text(
                description!,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            if (progress != null) ...[
              SizedBox(height: AppSpacing.sm),
              AnimatedProgressBar(value: progress!, color: color),
            ],
            if (trend != null) ...[
              SizedBox(height: AppSpacing.xs),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    trend!.isPositive
                        ? Icons.trending_up_rounded
                        : Icons.trending_down_rounded,
                    size: 14,
                    color: trend!.isPositive
                        ? context.semanticColors.success
                        : theme.colorScheme.error,
                  ),
                  SizedBox(width: AppSpacing.xs),
                  Text(
                    trend!.label,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: trend!.isPositive
                          ? context.semanticColors.success
                          : theme.colorScheme.error,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
