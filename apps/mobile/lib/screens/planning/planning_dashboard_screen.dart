import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/gamification_profile.dart';
import '../../providers/planning_providers.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/logout_button.dart';
import '../../widgets/page_header.dart';
import '../../widgets/stat_card.dart';

class PlanningDashboardScreen extends ConsumerWidget {
  const PlanningDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(planningStatsProvider);
    final gamificationAsync = ref.watch(gamificationProvider);

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(planningStatsProvider);
            ref.invalidate(gamificationProvider);
            await ref.read(planningStatsProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              AppPageHeader(
                title: 'Planejamento',
                icon: Icons.calendar_month_outlined,
                color: context.semanticColors.info,
                trailing: const LogoutButton(),
              ),
              SizedBox(height: AppSpacing.md),
              statsAsync.when(
                loading: () =>
                    const LoadingState(variant: LoadingVariant.stats),
                error: (error, stackTrace) => Text('Erro: $error'),
                data: (stats) => Row(
                  children: [
                    Expanded(
                      child: StatCard(
                        title: 'Tarefas ativas',
                        value: '${stats.activeTasks}',
                        icon: Icons.checklist_rounded,
                        accent: StatAccent.info,
                      ),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: StatCard(
                        title: 'Metas ativas',
                        value: '${stats.activeGoals}',
                        icon: Icons.flag_outlined,
                        accent: StatAccent.primary,
                      ),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: StatCard(
                        title: 'Conclusão 7d',
                        value: '${stats.completionRate7d.round()}%',
                        icon: Icons.trending_up_rounded,
                        accent: StatAccent.success,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: AppSpacing.md),
              gamificationAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (error, stackTrace) => const SizedBox.shrink(),
                data: (profile) => _GamificationCard(profile: profile),
              ),
              SizedBox(height: AppSpacing.md),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                mainAxisSpacing: AppSpacing.sm,
                crossAxisSpacing: AppSpacing.sm,
                childAspectRatio: 1.6,
                children: [
                  _ModuleTile(
                    label: 'Tarefas & Metas',
                    icon: Icons.checklist_rounded,
                    color: context.semanticColors.info,
                    onTap: () => context.go('/planning/tasks-goals'),
                  ),
                  _ModuleTile(
                    label: 'Treino',
                    icon: Icons.fitness_center_rounded,
                    color: context.semanticColors.warning,
                    onTap: () => context.go('/planning/workout'),
                  ),
                  _ModuleTile(
                    label: 'Nutrição',
                    icon: Icons.restaurant_rounded,
                    color: context.semanticColors.success,
                    onTap: () => context.go('/planning/nutrition'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GamificationCard extends StatelessWidget {
  final GamificationProfile profile;

  const _GamificationCard({required this.profile});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: AppRadius.lgRadius,
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.12),
            child: Text(
              'Nv ${profile.currentLevel}',
              style: theme.textTheme.labelSmall
                  ?.copyWith(color: theme.colorScheme.primary),
            ),
          ),
          SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: AppRadius.smRadius,
                  child: LinearProgressIndicator(
                    value: (profile.levelProgressPct / 100).clamp(0, 1),
                    minHeight: 6,
                  ),
                ),
                SizedBox(height: AppSpacing.xs),
                Text(
                  '${profile.totalXp} XP · streak ${profile.currentStreak} dias',
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          Icon(Icons.local_fire_department_rounded,
              color: context.semanticColors.warning),
        ],
      ),
    );
  }
}

class _ModuleTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ModuleTile({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      borderRadius: AppRadius.lgRadius,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: AppRadius.lgRadius,
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color),
            SizedBox(height: AppSpacing.xs),
            Text(label, style: theme.textTheme.titleSmall),
          ],
        ),
      ),
    );
  }
}
