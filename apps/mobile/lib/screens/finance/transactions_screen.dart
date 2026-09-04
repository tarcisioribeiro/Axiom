import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../models/expense.dart';
import '../../models/revenue.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/page_header.dart';
import '../../widgets/row_actions.dart';
import '../../widgets/stat_card.dart';
import 'expense_form_sheet.dart';
import 'revenue_form_sheet.dart';

class TransactionsScreen extends StatelessWidget {
  const TransactionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.md,
                  0,
                ),
                child: AppPageHeader(
                  title: 'Transações',
                  icon: Icons.receipt_long_outlined,
                  color: context.semanticColors.success,
                ),
              ),
              TabBar(
                tabs: const [Tab(text: 'Despesas'), Tab(text: 'Receitas')],
              ),
              const Expanded(
                child: TabBarView(
                  children: [_ExpensesTab(), _RevenuesTab()],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ExpensesTab extends ConsumerStatefulWidget {
  const _ExpensesTab();

  @override
  ConsumerState<_ExpensesTab> createState() => _ExpensesTabState();
}

class _ExpensesTabState extends ConsumerState<_ExpensesTab> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _delete(Expense expense) async {
    try {
      await ref.read(expensesServiceProvider).delete(expense.id);
      ref.invalidate(expensesProvider);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _togglePaid(Expense expense) async {
    try {
      await ref
          .read(expensesServiceProvider)
          .patch(expense.id, {'payed': !expense.payed});
      ref.invalidate(expensesProvider);
    } on ApiException catch (_) {
      // Best-effort toggle; provider refresh will reflect the true state.
    }
  }

  @override
  Widget build(BuildContext context) {
    final expensesAsync = ref.watch(expensesProvider);
    final accountsAsync = ref.watch(accountsProvider);
    final accounts = accountsAsync.valueOrNull ?? const <Account>[];

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: accounts.isEmpty
            ? null
            : () => showExpenseFormSheet(context, accounts: accounts),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(expensesProvider);
          await ref.read(expensesProvider.future);
        },
        child: expensesAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, _) => Center(child: Text('Erro: $error')),
          data: (allExpenses) {
            final query = _searchController.text.trim().toLowerCase();
            final expenses = query.isEmpty
                ? allExpenses
                : allExpenses
                    .where((e) => e.description.toLowerCase().contains(query))
                    .toList();
            final total = allExpenses.fold<double>(0, (s, e) => s + e.value);
            final paid = allExpenses
                .where((e) => e.payed)
                .fold<double>(0, (s, e) => s + e.value);

            return ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    isDense: true,
                    hintText: 'Buscar despesas...',
                    prefixIcon: Icon(Icons.search_rounded, size: 20),
                  ),
                ),
                SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: StatCard(
                        title: 'Total',
                        value: AppFormatters.currency(total),
                        icon: Icons.receipt_long_outlined,
                        accent: StatAccent.neutral,
                      ),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: StatCard(
                        title: 'Pago',
                        value: AppFormatters.currency(paid),
                        icon: Icons.check_circle_outline,
                        accent: StatAccent.success,
                      ),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: StatCard(
                        title: 'Pendente',
                        value: AppFormatters.currency(total - paid),
                        icon: Icons.schedule_outlined,
                        accent: StatAccent.warning,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: AppSpacing.md),
                if (expenses.isEmpty)
                  const EmptyState(
                    icon: Icons.receipt_long_outlined,
                    title: 'Nenhuma despesa encontrada',
                  )
                else
                  ...expenses.map(
                    (expense) => _TransactionTile(
                      title: expense.description,
                      subtitle:
                          '${ChoiceLabels.of(ChoiceLabels.expenseCategories, expense.category)} · ${AppFormatters.date(expense.date)}',
                      value: expense.value,
                      isPositive: false,
                      done: expense.payed,
                      doneLabel: 'Pago',
                      pendingLabel: 'Pendente',
                      onToggleDone: () => _togglePaid(expense),
                      onEdit: () => showExpenseFormSheet(
                        context,
                        existing: expense,
                        accounts: accounts,
                      ),
                      onDelete: () => _delete(expense),
                      deleteMessage:
                          'Excluir a despesa "${expense.description}"? '
                          'Essa ação não pode ser desfeita.',
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _RevenuesTab extends ConsumerStatefulWidget {
  const _RevenuesTab();

  @override
  ConsumerState<_RevenuesTab> createState() => _RevenuesTabState();
}

class _RevenuesTabState extends ConsumerState<_RevenuesTab> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _delete(Revenue revenue) async {
    try {
      await ref.read(revenuesServiceProvider).delete(revenue.id);
      ref.invalidate(revenuesProvider);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _toggleReceived(Revenue revenue) async {
    try {
      await ref
          .read(revenuesServiceProvider)
          .patch(revenue.id, {'received': !revenue.received});
      ref.invalidate(revenuesProvider);
    } on ApiException catch (_) {
      // Best-effort toggle; provider refresh will reflect the true state.
    }
  }

  @override
  Widget build(BuildContext context) {
    final revenuesAsync = ref.watch(revenuesProvider);
    final accountsAsync = ref.watch(accountsProvider);
    final accounts = accountsAsync.valueOrNull ?? const <Account>[];

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: accounts.isEmpty
            ? null
            : () => showRevenueFormSheet(context, accounts: accounts),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(revenuesProvider);
          await ref.read(revenuesProvider.future);
        },
        child: revenuesAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, _) => Center(child: Text('Erro: $error')),
          data: (allRevenues) {
            final query = _searchController.text.trim().toLowerCase();
            final revenues = query.isEmpty
                ? allRevenues
                : allRevenues
                    .where((r) => r.description.toLowerCase().contains(query))
                    .toList();
            final total = allRevenues.fold<double>(0, (s, r) => s + r.value);
            final received = allRevenues
                .where((r) => r.received)
                .fold<double>(0, (s, r) => s + r.value);

            return ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    isDense: true,
                    hintText: 'Buscar receitas...',
                    prefixIcon: Icon(Icons.search_rounded, size: 20),
                  ),
                ),
                SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: StatCard(
                        title: 'Total',
                        value: AppFormatters.currency(total),
                        icon: Icons.trending_up_rounded,
                        accent: StatAccent.neutral,
                      ),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: StatCard(
                        title: 'Recebido',
                        value: AppFormatters.currency(received),
                        icon: Icons.check_circle_outline,
                        accent: StatAccent.success,
                      ),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: StatCard(
                        title: 'Pendente',
                        value: AppFormatters.currency(total - received),
                        icon: Icons.schedule_outlined,
                        accent: StatAccent.warning,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: AppSpacing.md),
                if (revenues.isEmpty)
                  const EmptyState(
                    icon: Icons.trending_up_rounded,
                    title: 'Nenhuma receita encontrada',
                  )
                else
                  ...revenues.map(
                    (revenue) => _TransactionTile(
                      title: revenue.description,
                      subtitle:
                          '${ChoiceLabels.of(ChoiceLabels.revenueCategories, revenue.category)} · ${AppFormatters.date(revenue.date)}',
                      value: revenue.value,
                      isPositive: true,
                      done: revenue.received,
                      doneLabel: 'Recebido',
                      pendingLabel: 'Pendente',
                      onToggleDone: () => _toggleReceived(revenue),
                      onEdit: () => showRevenueFormSheet(
                        context,
                        existing: revenue,
                        accounts: accounts,
                      ),
                      onDelete: () => _delete(revenue),
                      deleteMessage:
                          'Excluir a receita "${revenue.description}"? '
                          'Essa ação não pode ser desfeita.',
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final double value;
  final bool isPositive;
  final bool done;
  final String doneLabel;
  final String pendingLabel;
  final VoidCallback onToggleDone;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final String deleteMessage;

  const _TransactionTile({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.isPositive,
    required this.done,
    required this.doneLabel,
    required this.pendingLabel,
    required this.onToggleDone,
    required this.onEdit,
    required this.onDelete,
    required this.deleteMessage,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    final valueColor = done
        ? muted
        : (isPositive
            ? context.semanticColors.success
            : theme.colorScheme.error);
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.smd,
        AppSpacing.smd,
        AppSpacing.sm,
        AppSpacing.smd,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: done ? muted : null,
                    decoration: done ? TextDecoration.lineThrough : null,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: 2),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(color: muted),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${isPositive ? '+' : '-'} ${AppFormatters.currency(value)}',
                style: theme.textTheme.titleSmall
                    ?.copyWith(color: valueColor, fontWeight: FontWeight.w700),
              ),
              SizedBox(height: AppSpacing.xs),
              _StatusToggle(
                done: done,
                label: done ? doneLabel : pendingLabel,
                onTap: onToggleDone,
              ),
            ],
          ),
          RowActionsMenu(
            onEdit: onEdit,
            onDelete: onDelete,
            deleteConfirmTitle: 'Excluir lançamento',
            deleteConfirmMessage: deleteMessage,
          ),
        ],
      ),
    );
  }
}

/// Tappable pill that toggles a transaction's paid/received state. Sized to
/// a real 32px-min touch target — the old inline pill was ~18px tall.
class _StatusToggle extends StatelessWidget {
  final bool done;
  final String label;
  final VoidCallback onTap;

  const _StatusToggle({
    required this.done,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color =
        done ? context.semanticColors.success : context.semanticColors.warning;
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.smRadius,
      child: Container(
        constraints: const BoxConstraints(minHeight: 32),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: AppRadius.smRadius,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              done ? Icons.check_circle_rounded : Icons.schedule_rounded,
              size: 13,
              color: color,
            ),
            SizedBox(width: AppSpacing.xs),
            Text(
              label,
              style: theme.textTheme.labelSmall?.copyWith(color: color),
            ),
          ],
        ),
      ),
    );
  }
}
