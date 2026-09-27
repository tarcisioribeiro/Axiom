import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';

/// Icon badge + title/subtitle + optional trailing action — mirrors
/// `components/common/PageHeader` on the web app, including the
/// module-color-coded, ringed icon badge. Callers pass the module's
/// `context.palette` category color as [color] (finance → Finanças,
/// health → Planejamento, exercise → Treino, nutrition → Nutrição,
/// intellect → Biblioteca, studies → Segurança; primary for Agente IA).
class AppPageHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final IconData icon;
  final Color color;
  final Widget? trailing;

  const AppPageHeader({
    super.key,
    required this.title,
    required this.icon,
    required this.color,
    this.subtitle,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: AppRadius.lgRadius,
            border: Border.all(color: color.withValues(alpha: 0.2)),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.5,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (subtitle != null)
                Text(
                  subtitle!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
            ],
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}

/// AppBar title for detail screens: the module's ringed icon badge + title,
/// so sub-screens keep the same identity as the [AppPageHeader].
class ModuleAppBarTitle extends StatelessWidget {
  final IconData icon;
  final Color color;
  final Widget title;

  const ModuleAppBarTitle({
    super.key,
    required this.icon,
    required this.color,
    required this.title,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: AppRadius.mdRadius,
            border: Border.all(color: color.withValues(alpha: 0.2)),
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        SizedBox(width: AppSpacing.sm),
        Flexible(child: title),
      ],
    );
  }
}
