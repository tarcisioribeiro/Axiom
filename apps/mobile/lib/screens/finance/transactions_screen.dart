import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../models/expense.dart';
import '../../models/revenue.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_badge.dart';
import '../../widgets/app_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/feedback.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/motion.dart';
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
                  color: context.palette.finance,
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
  _Filters _filters = const _Filters();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _delete(Expense expense) async {
    try {
      await ref.read(expensesServiceProvider).delete(expense.id);
      if (mounted) showAppToast(context, 'Excluído com sucesso.');
      ref.invalidate(expensesProvider);
    } on ApiException catch (e) {
      if (mounted) {
        showAppToast(context, e.message, kind: ToastKind.error);
      }
    }
  }

  Future<void> _togglePaid(Expense expense) async {
    try {
      await ref
          .read(expensesServiceProvider)
          .patch(expense.id, {'payed': !expense.payed});
      ref.invalidate(expensesProvider);
    } on ApiException catch (e) {
      if (mounted) showAppToast(context, e.message, kind: ToastKind.error);
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
        child: AsyncSwitcher(
            child: expensesAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, _) => ErrorState(
              error: error, onRetry: () => ref.invalidate(expensesProvider)),
          data: (allExpenses) {
            final query = _searchController.text.trim().toLowerCase();
            final expenses = allExpenses
                .where((x) =>
                    (query.isEmpty ||
                        x.description.toLowerCase().contains(query)) &&
                    _filters.matches(x.category, x.payed, x.date))
                .toList();
            final total = expenses.fold<double>(0, (s, e) => s + e.value);
            final paid = expenses
                .where((e) => e.payed)
                .fold<double>(0, (s, e) => s + e.value);

            return CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  sliver: SliverToBoxAdapter(
                    child: Column(
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
                        _FilterBar(
                          filters: _filters,
                          categories: ChoiceLabels.expenseCategories,
                          doneLabel: 'Pago',
                          onChanged: (f) => setState(() => _filters = f),
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
                      ],
                    ),
                  ),
                ),
                if (expenses.isEmpty)
                  const SliverToBoxAdapter(
                    child: EmptyState(
                      icon: Icons.receipt_long_outlined,
                      title: 'Nenhuma despesa encontrada',
                    ),
                  )
                else
                  SliverPadding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                    sliver: SliverList.builder(
                      itemCount: expenses.length,
                      itemBuilder: (context, index) {
                        final expense = expenses[index];
                        return _TransactionTile(
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
                        );
                      },
                    ),
                  ),
                const SliverPadding(
                    padding: EdgeInsets.only(bottom: AppSpacing.md)),
              ],
            );
          },
        )),
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
  _Filters _filters = const _Filters();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _delete(Revenue revenue) async {
    try {
      await ref.read(revenuesServiceProvider).delete(revenue.id);
      if (mounted) showAppToast(context, 'Excluído com sucesso.');
      ref.invalidate(revenuesProvider);
    } on ApiException catch (e) {
      if (mounted) {
        showAppToast(context, e.message, kind: ToastKind.error);
      }
    }
  }

  Future<void> _toggleReceived(Revenue revenue) async {
    try {
      await ref
          .read(revenuesServiceProvider)
          .patch(revenue.id, {'received': !revenue.received});
      ref.invalidate(revenuesProvider);
    } on ApiException catch (e) {
      if (mounted) showAppToast(context, e.message, kind: ToastKind.error);
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
        child: AsyncSwitcher(
            child: revenuesAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, _) => ErrorState(
              error: error, onRetry: () => ref.invalidate(revenuesProvider)),
          data: (allRevenues) {
            final query = _searchController.text.trim().toLowerCase();
            final revenues = allRevenues
                .where((x) =>
                    (query.isEmpty ||
                        x.description.toLowerCase().contains(query)) &&
                    _filters.matches(x.category, x.received, x.date))
                .toList();
            final total = revenues.fold<double>(0, (s, r) => s + r.value);
            final received = revenues
                .where((r) => r.received)
                .fold<double>(0, (s, r) => s + r.value);

            return CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  sliver: SliverToBoxAdapter(
                    child: Column(
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
                        _FilterBar(
                          filters: _filters,
                          categories: ChoiceLabels.revenueCategories,
                          doneLabel: 'Recebido',
                          onChanged: (f) => setState(() => _filters = f),
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
                      ],
                    ),
                  ),
                ),
                if (revenues.isEmpty)
                  const SliverToBoxAdapter(
                    child: EmptyState(
                      icon: Icons.trending_up_rounded,
                      title: 'Nenhuma receita encontrada',
                    ),
                  )
                else
                  SliverPadding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                    sliver: SliverList.builder(
                      itemCount: revenues.length,
                      itemBuilder: (context, index) {
                        final revenue = revenues[index];
                        return _TransactionTile(
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
                        );
                      },
                    ),
                  ),
                const SliverPadding(
                    padding: EdgeInsets.only(bottom: AppSpacing.md)),
              ],
            );
          },
        )),
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

/// Tappable status badge that toggles a transaction's paid/received state,
/// padded to a 32px-min touch target.
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
    final color =
        done ? context.semanticColors.success : context.semanticColors.warning;
    return Semantics(
      button: true,
      label: '$label, toque para alternar',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 32),
          child: Center(
            widthFactor: 1,
            child: AppBadge(
              label: label,
              color: color,
              icon: done ? Icons.check_circle_rounded : Icons.schedule_rounded,
            ),
          ),
        ),
      ),
    );
  }
}

/// Active transaction filters (web `FilterBar`): category, status, period.
class _Filters {
  final String? category;
  final bool? done;
  final DateTimeRange? range;

  const _Filters({this.category, this.done, this.range});

  bool matches(String category, bool done, DateTime date) =>
      (this.category == null || this.category == category) &&
      (this.done == null || this.done == done) &&
      (range == null ||
          (!date.isBefore(range!.start) &&
              date.isBefore(range!.end.add(const Duration(days: 1)))));
}

class _FilterBar extends StatelessWidget {
  final _Filters filters;
  final Map<String, String> categories;
  final String doneLabel;
  final ValueChanged<_Filters> onChanged;

  const _FilterBar({
    required this.filters,
    required this.categories,
    required this.doneLabel,
    required this.onChanged,
  });

  Future<void> _pickCategory(BuildContext context) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.7,
          ),
          child: ListView(
            shrinkWrap: true,
            children: [
              for (final e in categories.entries)
                ListTile(
                  title: Text(e.value),
                  selected: e.key == filters.category,
                  onTap: () => Navigator.of(context).pop(e.key),
                ),
            ],
          ),
        ),
      ),
    );
    if (picked != null) {
      onChanged(
          _Filters(category: picked, done: filters.done, range: filters.range));
    }
  }

  Future<void> _pickRange(BuildContext context) async {
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 5),
      lastDate: DateTime(now.year + 5),
      initialDateRange: filters.range ??
          DateTimeRange(
            start: DateTime(now.year, now.month),
            end: DateTime(now.year, now.month + 1, 0),
          ),
    );
    if (range != null) {
      onChanged(_Filters(
          category: filters.category, done: filters.done, range: range));
    }
  }

  @override
  Widget build(BuildContext context) {
    final f = filters;
    final range = f.range;
    return Padding(
      padding: EdgeInsets.only(top: AppSpacing.sm),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            FilterChip(
              label: Text(f.category == null
                  ? 'Categoria'
                  : ChoiceLabels.of(categories, f.category!)),
              selected: f.category != null,
              onSelected: (_) => _pickCategory(context),
              onDeleted: f.category == null
                  ? null
                  : () => onChanged(_Filters(done: f.done, range: f.range)),
            ),
            SizedBox(width: AppSpacing.xs),
            FilterChip(
              label: Text(doneLabel),
              selected: f.done == true,
              onSelected: (on) => onChanged(_Filters(
                  category: f.category, done: on ? true : null, range: range)),
            ),
            SizedBox(width: AppSpacing.xs),
            FilterChip(
              label: const Text('Pendente'),
              selected: f.done == false,
              onSelected: (on) => onChanged(_Filters(
                  category: f.category, done: on ? false : null, range: range)),
            ),
            SizedBox(width: AppSpacing.xs),
            FilterChip(
              label: Text(range == null
                  ? 'Período'
                  : '${AppFormatters.date(range.start)} – '
                      '${AppFormatters.date(range.end)}'),
              selected: range != null,
              onSelected: (_) => _pickRange(context),
              onDeleted: range == null
                  ? null
                  : () =>
                      onChanged(_Filters(category: f.category, done: f.done)),
            ),
          ],
        ),
      ),
    );
  }
}
