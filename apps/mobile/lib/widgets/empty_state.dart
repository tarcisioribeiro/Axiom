import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import 'motion.dart';

/// "Nothing here yet" placeholder — mirrors `components/common/EmptyState`
/// on the web app: dashed `card/50` box, ringed icon badge, bold title,
/// muted message, optional outline call-to-action, fading in.
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = theme.colorScheme.primary;
    return FadeIn(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: CustomPaint(
          painter: _DashedBorderPainter(theme.colorScheme.outline),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.xl + AppSpacing.md,
            ),
            decoration: BoxDecoration(
              color: theme.cardColor.withValues(alpha: 0.5),
              borderRadius: AppRadius.lgRadius,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: primary.withValues(alpha: 0.1),
                    borderRadius: AppRadius.xlRadius,
                    border: Border.all(color: primary.withValues(alpha: 0.2)),
                  ),
                  child: Icon(icon, size: 28, color: primary),
                ),
                SizedBox(height: AppSpacing.md),
                Text(
                  title,
                  style: theme.textTheme.titleMedium,
                  textAlign: TextAlign.center,
                ),
                if (message != null) ...[
                  SizedBox(height: AppSpacing.xs),
                  Text(
                    message!,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
                if (actionLabel != null && onAction != null) ...[
                  SizedBox(height: AppSpacing.md),
                  OutlinedButton(
                    onPressed: onAction,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: primary,
                      minimumSize: const Size(0, 44),
                    ),
                    child: Text(actionLabel!),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  final Color color;

  _DashedBorderPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final path = Path()
      ..addRRect(AppRadius.lgRadius.toRRect(Offset.zero & size));
    for (final metric in path.computeMetrics()) {
      for (var d = 0.0; d < metric.length; d += 10) {
        canvas.drawPath(metric.extractPath(d, d + 5), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter old) => old.color != color;
}
