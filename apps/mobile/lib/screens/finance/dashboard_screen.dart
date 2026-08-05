import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/dashboard_stats.dart';
import '../../providers/finance_providers.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/formatters.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/logout_button.dart';
import '../../widgets/page_header.dart';
import '../../widgets/stat_card.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(dashboardStatsProvider);
    ref.invalidate(financialAlertsProvider);
    ref.invalidate(healthScoreProvider);
    ref.invalidate(cashFlowForecastProvider);
    await ref.read(dashboardStatsProvider.future);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(dashboardStatsProvider);
    final alertsAsync = ref.watch(financialAlertsProvider);
    final healthAsync = ref.watch(healthScoreProvider);
    final forecastAsync = ref.watch(cashFlowForecastProvider);

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              AppPageHeader(
                title: 'Dashboard',
                icon: Icons.space_dashboard_outlined,
                color: context.semanticColors.success,
                trailing: const LogoutButton(),
              ),
              SizedBox(height: AppSpacing.md),
              statsAsync.when(
                loading: () =>
                    const LoadingState(variant: LoadingVariant.stats),
                error: (error, _) => _ErrorText(error),
                data: (stats) => _StatsGrid(stats: stats),
              ),
              SizedBox(height: AppSpacing.md),
              healthAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (error, stackTrace) => const SizedBox.shrink(),
                data: (health) => _HealthScoreCard(health: health),
              ),
              alertsAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (error, stackTrace) => const SizedBox.shrink(),
                data: (alerts) => alerts.isEmpty
                    ? const SizedBox.shrink()
                    : Padding(
                        padding: EdgeInsets.only(top: AppSpacing.md),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Alertas',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            SizedBox(height: AppSpacing.sm),
                            ...alerts.map((a) => _AlertTile(alert: a)),
                          ],
                        ),
                      ),
              ),
              SizedBox(height: AppSpacing.md),
              forecastAsync.when(
                loading: () => const LoadingState(
                    variant: LoadingVariant.list, itemCount: 1),
                error: (error, _) => _ErrorText(error),
                data: (forecast) => _ForecastChart(forecast: forecast),
              ),
              SizedBox(height: AppSpacing.xl),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  final DashboardStats stats;

  const _StatsGrid({required this.stats});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        StatCard(
          title: 'Saldo total',
          value: AppFormatters.currency(stats.totalBalance),
          icon: Icons.account_balance_wallet_rounded,
          accent: StatAccent.primary,
          prominent: true,
        ),
        SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: StatCard(
                title: 'Receitas',
                value: AppFormatters.currency(stats.totalRevenues),
                icon: Icons.trending_up_rounded,
                accent: StatAccent.success,
              ),
            ),
            SizedBox(width: AppSpacing.sm),
            Expanded(
              child: StatCard(
                title: 'Despesas',
                value: AppFormatters.currency(stats.totalExpenses),
                icon: Icons.trending_down_rounded,
                accent: StatAccent.destructive,
              ),
            ),
          ],
        ),
        SizedBox(height: AppSpacing.sm),
        StatCard(
          title: 'Crédito usado',
          value: AppFormatters.currency(stats.usedCreditLimit),
          description: 'de ${AppFormatters.currency(stats.totalCreditLimit)}',
          icon: Icons.credit_card_rounded,
          accent: StatAccent.warning,
          progress: stats.totalCreditLimit <= 0
              ? 0
              : stats.usedCreditLimit / stats.totalCreditLimit,
        ),
      ],
    );
  }
}

class _HealthScoreCard extends StatelessWidget {
  final HealthScore health;

  const _HealthScoreCard({required this.health});

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
            radius: 24,
            backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.12),
            child: Text(
              health.grade,
              style: theme.textTheme.titleLarge?.copyWith(
                color: theme.colorScheme.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Saúde financeira', style: theme.textTheme.titleSmall),
                Text(
                  '${health.score}/100',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
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

class _AlertTile extends StatelessWidget {
  final FinancialAlert alert;

  const _AlertTile({required this.alert});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = alert.isDanger
        ? theme.colorScheme.error
        : context.semanticColors.warning;
    return Container(
      margin: EdgeInsets.only(bottom: AppSpacing.xs),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: AppRadius.mdRadius,
        border: Border(left: BorderSide(color: color, width: 3)),
      ),
      child: Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: color, size: 18),
          SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(alert.message, style: theme.textTheme.bodySmall),
          ),
        ],
      ),
    );
  }
}

class _ForecastChart extends StatelessWidget {
  final CashFlowForecast forecast;

  const _ForecastChart({required this.forecast});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (forecast.dailyBreakdown.isEmpty) return const SizedBox.shrink();

    final spots = <FlSpot>[
      for (var i = 0; i < forecast.dailyBreakdown.length; i++)
        FlSpot(i.toDouble(), forecast.dailyBreakdown[i].balance),
    ];

    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: AppRadius.lgRadius,
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Previsão de saldo — ${forecast.periodDays} dias',
            style: theme.textTheme.titleSmall,
          ),
          SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 160,
            child: LineChart(
              LineChartData(
                gridData: const FlGridData(show: false),
                titlesData: const FlTitlesData(show: false),
                borderData: FlBorderData(show: false),
                lineTouchData: const LineTouchData(enabled: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    barWidth: 2,
                    color: theme.colorScheme.primary,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: theme.colorScheme.primary.withValues(alpha: 0.12),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorText extends StatelessWidget {
  final Object error;

  const _ErrorText(this.error);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Text(
        'Não foi possível carregar: $error',
        style: TextStyle(color: Theme.of(context).colorScheme.error),
      ),
    );
  }
}
