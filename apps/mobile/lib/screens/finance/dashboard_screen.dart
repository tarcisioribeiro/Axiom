import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../models/account.dart';
import '../../models/budget.dart';
import '../../models/dashboard_stats.dart';
import '../../providers/core_providers.dart';
import '../../providers/finance_providers.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_card.dart';
import '../../widgets/feedback.dart';
import '../../widgets/header_actions.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/module_tile.dart';
import '../../widgets/motion.dart';
import '../../widgets/page_header.dart';
import '../../widgets/stat_card.dart';
import 'expense_form_sheet.dart';
import 'revenue_form_sheet.dart';
import 'transfer_form_sheet.dart';

MonthYear get _thisMonth {
  final now = DateTime.now();
  return (month: now.month, year: now.year);
}

String _greeting() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref
      ..invalidate(dashboardStatsProvider)
      ..invalidate(financialAlertsProvider)
      ..invalidate(anomaliesProvider)
      ..invalidate(healthScoreProvider)
      ..invalidate(cashFlowForecastProvider)
      ..invalidate(accountsProvider)
      ..invalidate(expensesProvider)
      ..invalidate(budgetStatusProvider(_thisMonth));
    await ref.read(dashboardStatsProvider.future);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(dashboardStatsProvider);
    final alertsAsync = ref.watch(financialAlertsProvider);
    final anomaliesAsync = ref.watch(anomaliesProvider);
    final healthAsync = ref.watch(healthScoreProvider);
    final forecastAsync = ref.watch(cashFlowForecastProvider);
    final name = ref.watch(displayNameProvider).valueOrNull;
    final alerts = [
      for (final a in alertsAsync.valueOrNull ?? const <FinancialAlert>[])
        (message: a.message, danger: a.isDanger),
      for (final a in anomaliesAsync.valueOrNull ?? const <AnomalyAlert>[])
        (message: a.message, danger: a.severity == 'critical'),
    ];

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              AppPageHeader(
                title: name == null || name.isEmpty
                    ? _greeting()
                    : '${_greeting()}, $name',
                subtitle: 'Visão geral das suas finanças',
                icon: Icons.space_dashboard_outlined,
                color: context.palette.finance,
                trailing: const TabHeaderActions(),
              ),
              SizedBox(height: AppSpacing.md),
              const _QuickActions(),
              SizedBox(height: AppSpacing.md),
              AsyncSwitcher(
                child: statsAsync.when(
                  loading: () =>
                      const LoadingState(variant: LoadingVariant.stats),
                  error: (error, _) => ErrorState(
                    error: error,
                    onRetry: () => ref.invalidate(dashboardStatsProvider),
                  ),
                  data: (stats) => _StatsGrid(stats: stats),
                ),
              ),
              if (alerts.isNotEmpty) ...[
                const _SectionTitle('Alertas'),
                for (final a in alerts)
                  _AlertTile(message: a.message, danger: a.danger),
              ],
              const _SectionTitle('Cadastros'),
              const _FinanceModuleGrid(registrations: true),
              const _SectionTitle('Lançamentos'),
              const _FinanceModuleGrid(registrations: false),
              if (healthAsync.valueOrNull case final health?) ...[
                SizedBox(height: AppSpacing.md),
                _HealthScoreCard(health: health),
              ],
              const _AccountBalances(),
              SizedBox(height: AppSpacing.md),
              AsyncSwitcher(
                child: forecastAsync.when(
                  loading: () => const LoadingState(
                      variant: LoadingVariant.list, itemCount: 1),
                  error: (error, _) => ErrorState(
                    error: error,
                    onRetry: () => ref.invalidate(cashFlowForecastProvider),
                  ),
                  data: (forecast) => _ForecastChart(forecast: forecast),
                ),
              ),
              const _ExpensesByCategory(),
              const _MonthBudgets(),
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

/// Web dashboard "ações rápidas": Nova despesa / Nova receita / Transferência.
class _QuickActions extends ConsumerWidget {
  const _QuickActions();

  Future<void> _open(
    BuildContext context,
    WidgetRef ref,
    int minAccounts,
    Future<bool?> Function(List<Account>) open,
  ) async {
    final accounts = await ref.read(accountsProvider.future);
    if (!context.mounted) return;
    if (accounts.length < minAccounts) {
      showAppToast(
        context,
        minAccounts > 1
            ? 'Cadastre ao menos duas contas para transferir.'
            : 'Cadastre uma conta primeiro.',
        kind: ToastKind.info,
      );
      return;
    }
    await open(accounts);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.semanticColors;
    final scheme = Theme.of(context).colorScheme;
    Widget action(String label, IconData icon, Color color, VoidCallback f) =>
        Expanded(
          child: OutlinedButton.icon(
            onPressed: f,
            icon: Icon(icon, size: 18, color: color),
            label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
            style: OutlinedButton.styleFrom(
              foregroundColor: scheme.onSurface,
              side: BorderSide(color: color.withValues(alpha: 0.4)),
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
            ),
          ),
        );
    return Row(
      children: [
        action(
          'Despesa',
          Icons.remove_circle_outline,
          scheme.error,
          () => _open(context, ref, 1,
              (a) => showExpenseFormSheet(context, accounts: a)),
        ),
        SizedBox(width: AppSpacing.sm),
        action(
          'Receita',
          Icons.add_circle_outline,
          colors.success,
          () => _open(context, ref, 1,
              (a) => showRevenueFormSheet(context, accounts: a)),
        ),
        SizedBox(width: AppSpacing.sm),
        action(
          'Transferir',
          Icons.swap_horiz_rounded,
          colors.info,
          () => _open(context, ref, 2,
              (a) => showTransferFormSheet(context, accounts: a)),
        ),
      ],
    );
  }
}

/// Module shortcuts grouped like the web sidebar (`nav-config.ts`):
/// Cadastros / Lançamentos, all in the finance module color.
class _FinanceModuleGrid extends StatelessWidget {
  final bool registrations;

  const _FinanceModuleGrid({required this.registrations});

  @override
  Widget build(BuildContext context) {
    final color = context.palette.finance;
    ModuleTile tile(String label, IconData icon, String route) => ModuleTile(
          label: label,
          icon: icon,
          color: color,
          onTap: () => context.go(route),
        );
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      crossAxisCount: 2,
      mainAxisSpacing: AppSpacing.sm,
      crossAxisSpacing: AppSpacing.sm,
      childAspectRatio: 2.6,
      children: registrations
          ? [
              tile('Contas', Icons.account_balance_outlined,
                  '/finance/accounts'),
              tile('Cartões', Icons.credit_card_outlined,
                  '/finance/credit-cards'),
              tile('Membros', Icons.groups_outlined, '/finance/members'),
              tile('Orçamentos', Icons.pie_chart_outline_rounded,
                  '/finance/budgets'),
              tile('Metas', Icons.flag_outlined, '/finance/goals'),
              tile('Fixas', Icons.event_repeat_outlined, '/finance/fixed'),
            ]
          : [
              tile('Transações', Icons.receipt_long_outlined,
                  '/finance/transactions'),
              tile('Transferências', Icons.swap_horiz_rounded,
                  '/finance/transfers'),
              tile('A pagar / receber', Icons.request_quote_outlined,
                  '/finance/payables-receivables'),
              tile('Cofres', Icons.savings_outlined, '/finance/vaults'),
              tile('Empréstimos', Icons.handshake_outlined, '/finance/loans'),
              tile(
                  'Calendário', Icons.event_note_outlined, '/finance/calendar'),
              tile('Planejamento mensal', Icons.event_available_outlined,
                  '/finance/monthly-plan'),
            ],
    );
  }
}

/// Web "Saldo por conta".
class _AccountBalances extends ConsumerWidget {
  const _AccountBalances();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accounts = (ref.watch(accountsProvider).valueOrNull ?? const [])
        .where((a) => a.isActive)
        .toList();
    if (accounts.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionTitle('Saldo por conta'),
        AppCard(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Column(
            children: [
              for (final a in accounts)
                MergeSemantics(
                  child: ListTile(
                    dense: true,
                    title: Text(a.accountName),
                    subtitle: Text(a.institution),
                    trailing: Text(
                      AppFormatters.currency(a.availableBalance),
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: a.availableBalance < 0
                            ? theme.colorScheme.error
                            : null,
                      ),
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

/// Current-month expenses by category as a donut (web "Despesas por
/// categoria"), top 5 + "Outros".
class _ExpensesByCategory extends ConsumerWidget {
  const _ExpensesByCategory();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final expenses = ref.watch(expensesProvider).valueOrNull;
    if (expenses == null) return const SizedBox.shrink();
    final my = _thisMonth;
    final totals = <String, double>{};
    for (final e in expenses) {
      if (e.date.month == my.month && e.date.year == my.year) {
        totals[e.category] = (totals[e.category] ?? 0) + e.value;
      }
    }
    if (totals.isEmpty) return const SizedBox.shrink();
    final sorted = totals.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final top = sorted.take(5).toList();
    final rest = sorted.skip(5).fold<double>(0, (s, e) => s + e.value);
    final slices = [
      for (final e in top)
        (
          label: ChoiceLabels.of(ChoiceLabels.expenseCategories, e.key),
          value: e.value,
        ),
      if (rest > 0) (label: 'Outros', value: rest),
    ];
    final total = slices.fold<double>(0, (s, e) => s + e.value);
    final p = context.palette;
    final colors = [p.leisure, p.exercise, p.nutrition, p.studies, p.health];
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionTitle('Despesas por categoria'),
        AppCard(
          child: Row(
            children: [
              SizedBox(
                width: 120,
                height: 120,
                child: PieChart(
                  PieChartData(
                    centerSpaceRadius: 34,
                    sectionsSpace: 2,
                    sections: [
                      for (var i = 0; i < slices.length; i++)
                        PieChartSectionData(
                          value: slices[i].value,
                          color: i < colors.length ? colors[i] : p.work,
                          radius: 22,
                          showTitle: false,
                        ),
                    ],
                  ),
                ),
              ),
              SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (var i = 0; i < slices.length; i++)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Row(
                          children: [
                            Container(
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                color: i < colors.length ? colors[i] : p.work,
                                shape: BoxShape.circle,
                              ),
                            ),
                            SizedBox(width: AppSpacing.xs),
                            Expanded(
                              child: Text(
                                slices[i].label,
                                style: theme.textTheme.bodySmall,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Text(
                              AppFormatters.percent(slices[i].value / total),
                              style: theme.textTheme.labelMedium,
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Web "Orçamentos do mês".
class _MonthBudgets extends ConsumerWidget {
  const _MonthBudgets();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final budgets = ref.watch(budgetStatusProvider(_thisMonth)).valueOrNull ??
        const <BudgetStatus>[];
    if (budgets.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);
    final colors = context.semanticColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionTitle('Orçamentos do mês'),
        AppCard(
          child: Column(
            children: [
              for (final b in budgets) ...[
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        ChoiceLabels.of(
                            ChoiceLabels.expenseCategories, b.category),
                        style: theme.textTheme.bodyMedium,
                      ),
                    ),
                    Text(
                      '${AppFormatters.currency(b.actualSpent)} / '
                      '${AppFormatters.currency(b.effectiveLimit)}',
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
                SizedBox(height: AppSpacing.xs),
                AnimatedProgressBar(
                  value: b.percentage / 100,
                  color: b.percentage >= 100
                      ? theme.colorScheme.error
                      : b.percentage >= 80
                          ? colors.warning
                          : colors.success,
                ),
                if (b != budgets.last) SizedBox(height: AppSpacing.smd),
              ],
            ],
          ),
        ),
      ],
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
          countTo: stats.totalBalance,
          format: AppFormatters.currency,
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
                countTo: stats.totalRevenues,
                format: AppFormatters.currency,
                icon: Icons.trending_up_rounded,
                accent: StatAccent.success,
              ),
            ),
            SizedBox(width: AppSpacing.sm),
            Expanded(
              child: StatCard(
                title: 'Despesas',
                value: AppFormatters.currency(stats.totalExpenses),
                countTo: stats.totalExpenses,
                format: AppFormatters.currency,
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
          countTo: stats.usedCreditLimit,
          format: AppFormatters.currency,
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
    return AppCard(
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
  final String message;
  final bool danger;

  const _AlertTile({required this.message, required this.danger});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color =
        danger ? theme.colorScheme.error : context.semanticColors.warning;
    return Container(
      margin: EdgeInsets.only(bottom: AppSpacing.xs),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: AppRadius.mdRadius,
        border: Border(left: BorderSide(color: color, width: 4)),
      ),
      child: Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: color, size: 18),
          SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(message, style: theme.textTheme.bodySmall)),
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
    final days = forecast.dailyBreakdown;
    if (days.isEmpty) return const SizedBox.shrink();
    final axisStyle = theme.textTheme.labelSmall?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
      fontWeight: FontWeight.w400,
    );

    final spots = <FlSpot>[
      for (var i = 0; i < forecast.dailyBreakdown.length; i++)
        FlSpot(i.toDouble(), forecast.dailyBreakdown[i].balance),
    ];

    return AppCard(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.smd,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.smd,
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
            height: 180,
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) => FlLine(
                    color: theme.colorScheme.outlineVariant,
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(),
                  rightTitles: const AxisTitles(),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 44,
                      getTitlesWidget: (v, meta) => SideTitleWidget(
                        meta: meta,
                        child: Text(
                          NumberFormat.compact(locale: 'pt_BR').format(v),
                          style: axisStyle,
                        ),
                      ),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 22,
                      interval: (days.length / 4).ceilToDouble().clamp(1, 999),
                      getTitlesWidget: (v, meta) {
                        final i = v.toInt();
                        if (i < 0 || i >= days.length) {
                          return const SizedBox.shrink();
                        }
                        return SideTitleWidget(
                          meta: meta,
                          child: Text(
                            DateFormat('dd/MM').format(days[i].date),
                            style: axisStyle,
                          ),
                        );
                      },
                    ),
                  ),
                ),
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipColor: (_) => theme.colorScheme.inverseSurface,
                    getTooltipItems: (spots) => [
                      for (final s in spots)
                        LineTooltipItem(
                          '${DateFormat('dd/MM').format(days[s.x.toInt()].date)}\n'
                          '${AppFormatters.currency(s.y)}',
                          theme.textTheme.labelMedium!.copyWith(
                            color: theme.colorScheme.onInverseSurface,
                          ),
                        ),
                    ],
                  ),
                ),
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
