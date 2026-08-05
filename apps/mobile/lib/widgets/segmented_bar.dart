import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';

class SegmentedBarItem {
  final String label;
  final double value;
  final Color color;

  const SegmentedBarItem({
    required this.label,
    required this.value,
    required this.color,
  });
}

/// Thin multi-segment horizontal bar + dot legend — mirrors the
/// category-breakdown pattern repeated across Expenses/Revenues/Accounts on
/// the web app (a single `h-2` bar split proportionally by category, with a
/// colored-dot legend below).
class SegmentedBar extends StatelessWidget {
  final List<SegmentedBarItem> items;

  const SegmentedBar({super.key, required this.items});

  @override
  Widget build(BuildContext context) {
    final total = items.fold<double>(0, (sum, item) => sum + item.value);
    if (total <= 0 || items.isEmpty) return const SizedBox.shrink();

    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: AppRadius.smRadius,
          child: SizedBox(
            height: 8,
            child: Row(
              children: items
                  .map(
                    (item) => Expanded(
                      flex: (item.value / total * 1000).round().clamp(1, 1000),
                      child: ColoredBox(color: item.color),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
        SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.xs,
          children: items.map((item) {
            final pct = (item.value / total * 100).toStringAsFixed(0);
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: item.color,
                    shape: BoxShape.circle,
                  ),
                ),
                SizedBox(width: AppSpacing.xs),
                Text(
                  '${item.label} · $pct%',
                  style: theme.textTheme.bodySmall,
                ),
              ],
            );
          }).toList(),
        ),
      ],
    );
  }
}
