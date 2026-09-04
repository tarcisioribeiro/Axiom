import 'package:flutter/material.dart';

import '../models/habit_heatmap.dart';
import '../theme/app_spacing.dart';
import '../utils/formatters.dart';
import 'app_card.dart';

/// GitHub-style consistency grid: columns are ISO weeks, rows are weekdays
/// (Mon→Sun). Cell colour scales with the day's completion ratio; days with
/// nothing scheduled stay faint. Horizontally scrollable — a full year is
/// wider than a phone.
class HabitHeatmapView extends StatelessWidget {
  final HabitHeatmap heatmap;

  const HabitHeatmapView({super.key, required this.heatmap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (heatmap.days.isEmpty) {
      return const SizedBox.shrink();
    }

    // Bucket days into week columns keyed by the Monday of that week.
    final byDate = {
      for (final d in heatmap.days)
        DateTime(d.date.year, d.date.month, d.date.day): d,
    };
    final first = heatmap.days.first.date;
    final last = heatmap.days.last.date;
    var cursor = first.subtract(Duration(days: first.weekday - 1));
    final columns = <List<HeatmapDay?>>[];
    while (!cursor.isAfter(last)) {
      final col = <HeatmapDay?>[];
      for (var i = 0; i < 7; i++) {
        final day = cursor.add(Duration(days: i));
        col.add(byDate[DateTime(day.year, day.month, day.day)]);
      }
      columns.add(col);
      cursor = cursor.add(const Duration(days: 7));
    }

    final scheduled = heatmap.days.where((d) => d.expected > 0).toList();
    final done = scheduled.where((d) => d.ratio >= 1).length;
    final rate = scheduled.isEmpty ? 0.0 : done / scheduled.length;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.smd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Consistência ${heatmap.year}',
                  style: theme.textTheme.titleSmall),
              Text('${(rate * 100).round()}% dos dias',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  )),
            ],
          ),
          SizedBox(height: AppSpacing.sm),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var row = 0; row < 7; row++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Row(
                      children: [
                        for (final col in columns)
                          _Cell(day: col[row], theme: theme),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  final HeatmapDay? day;
  final ThemeData theme;

  const _Cell({required this.day, required this.theme});

  @override
  Widget build(BuildContext context) {
    final d = day;
    Color color;
    if (d == null || d.expected == 0) {
      color = theme.colorScheme.surfaceContainerHighest;
    } else {
      final base = theme.colorScheme.primary;
      color = Color.lerp(
        base.withValues(alpha: 0.15),
        base,
        d.ratio,
      )!;
    }
    return Tooltip(
      message: d == null
          ? ''
          : '${AppFormatters.date(d.date)}: ${d.completed}/${d.expected}',
      child: Container(
        width: 12,
        height: 12,
        margin: const EdgeInsets.only(right: 2),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}
