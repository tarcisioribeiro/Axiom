import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../models/gamification_profile.dart';
import '../../providers/planning_providers.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../widgets/app_card.dart';
import '../../widgets/feedback.dart';
import '../../widgets/header_actions.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/module_tile.dart';
import '../../widgets/motion.dart';
import '../../widgets/page_header.dart';
import '../../widgets/stat_card.dart';

bool _inThisWeek(DateTime d) {
  final now = DateTime.now();
  final start = DateTime(now.year, now.month, now.day)
      .subtract(Duration(days: now.weekday - 1));
  return !d.isBefore(start) && d.isBefore(start.add(const Duration(days: 7)));
}

bool _isToday(DateTime d) {
  final now = DateTime.now();
  return d.year == now.year && d.month == now.month && d.day == now.day;
}

/// Task category → web `--category-*` token (social/household/other fall
/// back to neutral tones).
Color _categoryColor(BuildContext context, String category) {
  final p = context.palette;
  return switch (category) {
    'health' || 'personal_care' => p.health,
    'intellect' => p.intellect,
    'spiritual' => p.spiritual,
    'exercise' => p.exercise,
    'nutrition' => p.nutrition,
    'work' => p.work,
    'finance' => p.finance,
    'social' => p.leisure,
    _ => p.mutedForeground,
  };
}

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
            ref
              ..invalidate(planningStatsProvider)
              ..invalidate(gamificationProvider)
              ..invalidate(workoutSessionsProvider)
              ..invalidate(workoutPlansProvider)
              ..invalidate(mealLogsProvider);
            await ref.read(planningStatsProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              AppPageHeader(
                title: 'Planejamento',
                icon: Icons.calendar_month_outlined,
                color: context.palette.health,
                trailing: const TabHeaderActions(),
              ),
              SizedBox(height: AppSpacing.md),
              AsyncSwitcher(
                child: statsAsync.when(
                  loading: () =>
                      const LoadingState(variant: LoadingVariant.stats),
                  error: (error, stackTrace) => ErrorState(
                      error: error,
                      onRetry: () => ref.invalidate(planningStatsProvider)),
                  data: (stats) => _StatsGrid(stats: stats),
                ),
              ),
              if (gamificationAsync.valueOrNull case final profile?) ...[
                SizedBox(height: AppSpacing.md),
                _GamificationCard(profile: profile),
              ],
              const _SectionTitle('Módulos'),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                padding: EdgeInsets.zero,
                crossAxisCount: 2,
                mainAxisSpacing: AppSpacing.sm,
                crossAxisSpacing: AppSpacing.sm,
                childAspectRatio: 2.6,
                children: [
                  ModuleTile(
                    label: 'Tarefas & Metas',
                    icon: Icons.checklist_rounded,
                    color: context.palette.health,
                    onTap: () => context.go('/planning/tasks-goals'),
                  ),
                  ModuleTile(
                    label: 'Treino',
                    icon: Icons.fitness_center_rounded,
                    color: context.palette.exercise,
                    onTap: () => context.go('/planning/workout'),
                  ),
                  ModuleTile(
                    label: 'Nutrição',
                    icon: Icons.restaurant_rounded,
                    color: context.palette.nutrition,
                    onTap: () => context.go('/planning/nutrition'),
                  ),
                  ModuleTile(
                    label: 'Bem-estar',
                    icon: Icons.spa_rounded,
                    color: context.palette.health,
                    onTap: () => context.go('/planning/wellness'),
                  ),
                  ModuleTile(
                    label: 'Biblioteca',
                    icon: Icons.menu_book_rounded,
                    color: context.palette.intellect,
                    onTap: () => context.go('/planning/library'),
                  ),
                ],
              ),
              if (statsAsync.valueOrNull case final stats?) ...[
                _WeeklyProgress(stats: stats),
                const _WorkoutNutrition(),
                if (stats.tasksByCategory.isNotEmpty)
                  _TasksByCategory(stats: stats),
                if (stats.activeGoalsProgress.isNotEmpty)
                  _GoalsProgress(stats: stats),
              ],
              SizedBox(height: AppSpacing.xl),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;

  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: AppSpacing.lg, bottom: AppSpacing.sm),
      child: Text(text, style: Theme.of(context).textTheme.titleMedium),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  final PlanningStats stats;

  const _StatsGrid({required this.stats});

  @override
  Widget build(BuildContext context) {
    final today = stats.totalTasksToday == 0
        ? 0.0
        : stats.completedTasksToday / stats.totalTasksToday;
    Widget row(List<Widget> cards) => Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < cards.length; i++) ...[
              if (i > 0) SizedBox(width: AppSpacing.sm),
              Expanded(child: cards[i]),
            ],
          ],
        );
    return Column(
      children: [
        StatCard(
          title: 'Tarefas de hoje',
          value: '${stats.completedTasksToday}/${stats.totalTasksToday}',
          icon: Icons.today_rounded,
          accent: StatAccent.info,
          progress: today,
          prominent: true,
        ),
        SizedBox(height: AppSpacing.sm),
        row([
          StatCard(
            title: 'Sequência atual',
            value: '${stats.currentStreak} dias',
            description: 'Melhor: ${stats.bestStreak} dias',
            icon: Icons.local_fire_department_rounded,
            accent: StatAccent.warning,
          ),
          StatCard(
            title: 'Conclusão 7d',
            value: '${stats.completionRate7d.round()}%',
            icon: Icons.trending_up_rounded,
            accent: StatAccent.success,
          ),
        ]),
        SizedBox(height: AppSpacing.sm),
        row([
          StatCard(
            title: 'Tarefas ativas',
            value: '${stats.activeTasks}',
            icon: Icons.checklist_rounded,
            accent: StatAccent.primary,
          ),
          StatCard(
            title: 'Metas ativas',
            value: '${stats.activeGoals}',
            description: '${stats.completedGoals} concluídas',
            icon: Icons.flag_outlined,
            accent: StatAccent.primary,
          ),
        ]),
      ],
    );
  }
}

/// Web "Progresso semanal" + "XP semanal" (10 XP por tarefa concluída,
/// 20 por treino — same formula as `PersonalPlanningDashboard.tsx`).
class _WeeklyProgress extends ConsumerWidget {
  final PlanningStats stats;

  const _WeeklyProgress({required this.stats});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final days = stats.weeklyProgress;
    if (days.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);
    final color = context.palette.health;
    final sessions = (ref.watch(workoutSessionsProvider).valueOrNull ?? [])
        .where((s) => _inThisWeek(s.date))
        .length;
    final xp =
        days.fold<int>(0, (s, d) => s + d.completed) * 10 + sessions * 20;
    final labelStyle = theme.textTheme.labelSmall?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
      fontWeight: FontWeight.w400,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionTitle('Progresso semanal'),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.bolt_rounded,
                      color: context.semanticColors.warning, size: 18),
                  SizedBox(width: AppSpacing.xs),
                  Text('$xp XP nesta semana',
                      style: theme.textTheme.titleSmall),
                ],
              ),
              SizedBox(height: AppSpacing.smd),
              SizedBox(
                height: 140,
                child: BarChart(
                  BarChartData(
                    maxY: 100,
                    gridData: const FlGridData(show: false),
                    borderData: FlBorderData(show: false),
                    titlesData: FlTitlesData(
                      topTitles: const AxisTitles(),
                      rightTitles: const AxisTitles(),
                      leftTitles: const AxisTitles(),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 20,
                          getTitlesWidget: (v, meta) => SideTitleWidget(
                            meta: meta,
                            child: Text(
                              DateFormat.E('pt_BR')
                                  .format(days[v.toInt()].date)
                                  .substring(0, 3),
                              style: labelStyle,
                            ),
                          ),
                        ),
                      ),
                    ),
                    barTouchData: BarTouchData(
                      touchTooltipData: BarTouchTooltipData(
                        getTooltipColor: (_) =>
                            theme.colorScheme.inverseSurface,
                        getTooltipItem: (group, _, rod, __) => BarTooltipItem(
                          '${rod.toY.round()}% · '
                          '${days[group.x].completed} tarefas',
                          theme.textTheme.labelMedium!.copyWith(
                            color: theme.colorScheme.onInverseSurface,
                          ),
                        ),
                      ),
                    ),
                    barGroups: [
                      for (var i = 0; i < days.length; i++)
                        BarChartGroupData(x: i, barRods: [
                          BarChartRodData(
                            toY: days[i].rate.clamp(0, 100).toDouble(),
                            color: color,
                            width: 14,
                            borderRadius: const BorderRadius.vertical(
                                top: Radius.circular(4)),
                            backDrawRodData: BackgroundBarChartRodData(
                              show: true,
                              toY: 100,
                              color: color.withValues(alpha: 0.12),
                            ),
                          ),
                        ]),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Web "Treino & Nutrição": treinos da semana, plano ativo, refeições de
/// hoje, com atalhos.
class _WorkoutNutrition extends ConsumerWidget {
  const _WorkoutNutrition();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final sessions = (ref.watch(workoutSessionsProvider).valueOrNull ?? [])
        .where((s) => _inThisWeek(s.date))
        .length;
    final activePlan = (ref.watch(workoutPlansProvider).valueOrNull ?? [])
        .where((p) => p.isActive)
        .firstOrNull;
    final mealsToday = (ref.watch(mealLogsProvider).valueOrNull ?? [])
        .where((m) => _isToday(m.date))
        .length;
    final p = context.palette;

    Widget item(IconData icon, Color color, String title, String subtitle,
            String cta, String route) =>
        AppCard(
          accentColor: color,
          onTap: () => context.go(route),
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.md, AppSpacing.smd, AppSpacing.sm, AppSpacing.smd),
          child: Row(
            children: [
              Icon(icon, color: color),
              SizedBox(width: AppSpacing.smd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: theme.textTheme.titleSmall),
                    Text(
                      subtitle,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Text(cta,
                  style: theme.textTheme.labelMedium?.copyWith(color: color)),
              Icon(Icons.chevron_right_rounded, color: color),
            ],
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionTitle('Treino & Nutrição'),
        item(
          Icons.fitness_center_rounded,
          p.exercise,
          '$sessions treino(s) nesta semana',
          activePlan == null
              ? 'Nenhum plano ativo'
              : 'Plano ativo: ${activePlan.name}',
          'Treinar',
          '/planning/workout',
        ),
        SizedBox(height: AppSpacing.sm),
        item(
          Icons.restaurant_rounded,
          p.nutrition,
          '$mealsToday refeição(ões) hoje',
          'Registre o que comeu',
          'Registrar',
          '/planning/nutrition',
        ),
      ],
    );
  }
}

class _TasksByCategory extends StatelessWidget {
  final PlanningStats stats;

  const _TasksByCategory({required this.stats});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final max =
        stats.tasksByCategory.fold<int>(1, (m, c) => c.count > m ? c.count : m);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionTitle('Tarefas por categoria'),
        AppCard(
          child: Column(
            children: [
              for (final c in stats.tasksByCategory) ...[
                Row(
                  children: [
                    Expanded(
                        child:
                            Text(c.label, style: theme.textTheme.bodyMedium)),
                    Text('${c.count}', style: theme.textTheme.labelMedium),
                  ],
                ),
                SizedBox(height: AppSpacing.xs),
                AnimatedProgressBar(
                  value: c.count / max,
                  color: _categoryColor(context, c.category),
                ),
                if (c != stats.tasksByCategory.last)
                  SizedBox(height: AppSpacing.smd),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _GoalsProgress extends StatelessWidget {
  final PlanningStats stats;

  const _GoalsProgress({required this.stats});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = context.semanticColors.success;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionTitle('Progresso das metas'),
        AppCard(
          child: Column(
            children: [
              for (final g in stats.activeGoalsProgress) ...[
                Row(
                  children: [
                    Expanded(
                      child: Text(g.title,
                          style: theme.textTheme.bodyMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                    ),
                    Text('${g.progress.round()}%',
                        style: theme.textTheme.labelMedium),
                  ],
                ),
                SizedBox(height: AppSpacing.xs),
                AnimatedProgressBar(value: g.progress / 100, color: color),
                if (g != stats.activeGoalsProgress.last)
                  SizedBox(height: AppSpacing.smd),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _GamificationCard extends StatelessWidget {
  final GamificationProfile profile;

  const _GamificationCard({required this.profile});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
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
                AnimatedProgressBar(
                  value: profile.levelProgressPct / 100,
                  color: theme.colorScheme.primary,
                ),
                SizedBox(height: AppSpacing.xs),
                Text(
                  '${profile.totalXp} XP · sequência de '
                  '${profile.currentStreak} dias',
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
