import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../models/payable.dart';
import '../../models/receivable.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/installments_sheet.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/page_header.dart';
import '../../widgets/row_actions.dart';
import '../../widgets/stat_card.dart';
import 'payable_form_sheet.dart';
import 'receivable_form_sheet.dart';
import 'settle_form_sheet.dart';

/// Contas a pagar / a receber — the non-loan debt/credit tracking mirrored
/// from the web's `PayablesReceivables` page. Two tabs, same layout.
class PayablesReceivablesScreen extends StatelessWidget {
  const PayablesReceivablesScreen({super.key});

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
                  title: 'A pagar / A receber',
                  icon: Icons.receipt_long_rounded,
                  color: context.semanticColors.success,
                ),
              ),
              const TabBar(
                tabs: [Tab(text: 'A pagar'), Tab(text: 'A receber')],
              ),
              const Expanded(
                child: TabBarView(
                  children: [_PayablesTab(), _ReceivablesTab()],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PayablesTab extends ConsumerWidget {
  const _PayablesTab();

  Future<void> _delete(BuildContext context, WidgetRef ref, Payable p) async {
    try {
      await ref.read(payablesServiceProvider).delete(p.id);
      ref.invalidate(payablesProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _pay(BuildContext context, WidgetRef ref, Payable p,
      List<Account> accounts) async {
    if (accounts.isEmpty) return;
    await showSettleFormSheet(
      context,
      title: 'Registrar pagamento — ${p.description}',
      actionLabel: 'Pagar',
      suggestedValue: p.remainingValue,
      accounts: accounts,
      onConfirm: ({
        required value,
        required accountId,
        required date,
        notes,
      }) async {
        await ref.read(payablesServiceProvider).pay(
              p.id,
              value: value,
              accountId: accountId,
              date: date,
              notes: notes,
            );
        ref.invalidate(payablesProvider);
        ref.invalidate(accountsProvider);
        ref.invalidate(expensesProvider);
      },
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final payablesAsync = ref.watch(payablesProvider);
    final accounts = ref.watch(accountsProvider).valueOrNull ?? const [];

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => showPayableFormSheet(context),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(payablesProvider);
          await ref.read(payablesProvider.future);
        },
        child: payablesAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (e, _) => Center(child: Text('Erro: $e')),
          data: (items) {
            final outstanding =
                items.fold<double>(0, (s, p) => s + p.remainingValue);
            final overdue = items.where((p) => p.status == 'overdue').length;
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: StatCard(
                        title: 'Em aberto',
                        value: AppFormatters.currency(outstanding),
                        icon: Icons.trending_down_rounded,
                        accent: StatAccent.destructive,
                      ),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: StatCard(
                        title: 'Em atraso',
                        value: '$overdue',
                        icon: Icons.schedule_outlined,
                        accent: StatAccent.warning,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: AppSpacing.md),
                if (items.isEmpty)
                  const EmptyState(
                    icon: Icons.receipt_long_rounded,
                    title: 'Nada a pagar registrado',
                  )
                else
                  ...items.map(
                    (p) => _DebtTile(
                      title: p.description,
                      subtitle:
                          '${ChoiceLabels.of(ChoiceLabels.expenseCategories, p.category)}'
                          '${p.dueDate == null ? '' : ' · vence ${AppFormatters.date(p.dueDate!)}'}',
                      statusLabel: p.statusDisplay ??
                          ChoiceLabels.of(
                              ChoiceLabels.payableStatuses, p.status),
                      total: p.value,
                      settled: p.paidValue,
                      remaining: p.remainingValue,
                      progress: p.progress,
                      settleLabel: 'Pagar',
                      onSettle: p.remainingValue <= 0
                          ? null
                          : () => _pay(context, ref, p, accounts),
                      onInstallments: p.installments <= 1
                          ? null
                          : () => showInstallmentsSheet(
                                context,
                                title: 'Parcelas — ${p.description}',
                                load: () => ref
                                    .read(payablesServiceProvider)
                                    .installments(p.id),
                              ),
                      onEdit: () => showPayableFormSheet(context, existing: p),
                      onDelete: () => _delete(context, ref, p),
                      deleteMessage:
                          'Excluir "${p.description}"? Essa ação não pode ser desfeita.',
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

class _ReceivablesTab extends ConsumerWidget {
  const _ReceivablesTab();

  Future<void> _delete(
      BuildContext context, WidgetRef ref, Receivable r) async {
    try {
      await ref.read(receivablesServiceProvider).delete(r.id);
      ref.invalidate(receivablesProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _receive(BuildContext context, WidgetRef ref, Receivable r,
      List<Account> accounts) async {
    if (accounts.isEmpty) return;
    await showSettleFormSheet(
      context,
      title: 'Registrar recebimento — ${r.description}',
      actionLabel: 'Receber',
      suggestedValue: r.remainingValue,
      accounts: accounts,
      onConfirm: ({
        required value,
        required accountId,
        required date,
        notes,
      }) async {
        await ref.read(receivablesServiceProvider).receive(
              r.id,
              value: value,
              accountId: accountId,
              date: date,
              notes: notes,
            );
        ref.invalidate(receivablesProvider);
        ref.invalidate(accountsProvider);
        ref.invalidate(revenuesProvider);
      },
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final receivablesAsync = ref.watch(receivablesProvider);
    final accounts = ref.watch(accountsProvider).valueOrNull ?? const [];

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => showReceivableFormSheet(context),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(receivablesProvider);
          await ref.read(receivablesProvider.future);
        },
        child: receivablesAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (e, _) => Center(child: Text('Erro: $e')),
          data: (items) {
            final outstanding =
                items.fold<double>(0, (s, r) => s + r.remainingValue);
            final overdue = items.where((r) => r.status == 'overdue').length;
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: StatCard(
                        title: 'A receber',
                        value: AppFormatters.currency(outstanding),
                        icon: Icons.trending_up_rounded,
                        accent: StatAccent.success,
                      ),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: StatCard(
                        title: 'Em atraso',
                        value: '$overdue',
                        icon: Icons.schedule_outlined,
                        accent: StatAccent.warning,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: AppSpacing.md),
                if (items.isEmpty)
                  const EmptyState(
                    icon: Icons.receipt_long_rounded,
                    title: 'Nada a receber registrado',
                  )
                else
                  ...items.map(
                    (r) => _DebtTile(
                      title: r.description,
                      subtitle:
                          '${ChoiceLabels.of(ChoiceLabels.revenueCategories, r.category)}'
                          '${r.dueDate == null ? '' : ' · vence ${AppFormatters.date(r.dueDate!)}'}',
                      statusLabel: r.statusDisplay ??
                          ChoiceLabels.of(
                              ChoiceLabels.receivableStatuses, r.status),
                      total: r.value,
                      settled: r.receivedValue,
                      remaining: r.remainingValue,
                      progress: r.progress,
                      settleLabel: 'Receber',
                      onSettle: r.remainingValue <= 0
                          ? null
                          : () => _receive(context, ref, r, accounts),
                      onInstallments: r.dueDate == null
                          ? null
                          : () => showInstallmentsSheet(
                                context,
                                title: 'Parcelas — ${r.description}',
                                load: () => ref
                                    .read(receivablesServiceProvider)
                                    .installments(r.id),
                              ),
                      onEdit: () =>
                          showReceivableFormSheet(context, existing: r),
                      onDelete: () => _delete(context, ref, r),
                      deleteMessage:
                          'Excluir "${r.description}"? Essa ação não pode ser desfeita.',
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

class _DebtTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final String statusLabel;
  final double total;
  final double settled;
  final double remaining;
  final double progress;
  final String settleLabel;
  final VoidCallback? onSettle;
  final VoidCallback? onInstallments;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final String deleteMessage;

  const _DebtTile({
    required this.title,
    required this.subtitle,
    required this.statusLabel,
    required this.total,
    required this.settled,
    required this.remaining,
    required this.progress,
    required this.settleLabel,
    required this.onSettle,
    required this.onInstallments,
    required this.onEdit,
    required this.onDelete,
    required this.deleteMessage,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.smd,
        AppSpacing.smd,
        AppSpacing.sm,
        AppSpacing.smd,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: theme.textTheme.titleSmall),
                    Text(
                      '$subtitle · $statusLabel',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(width: AppSpacing.sm),
              Text(
                AppFormatters.currency(total),
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              RowActionsMenu(
                onEdit: onEdit,
                onDelete: onDelete,
                deleteConfirmTitle: 'Excluir',
                deleteConfirmMessage: deleteMessage,
              ),
            ],
          ),
          SizedBox(height: AppSpacing.xs),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: theme.colorScheme.surfaceContainerHighest,
            ),
          ),
          SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Liquidado ${AppFormatters.currency(settled)} · '
                  'resta ${AppFormatters.currency(remaining)}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
              if (onInstallments != null)
                TextButton(
                  onPressed: onInstallments,
                  style: TextButton.styleFrom(
                      visualDensity: VisualDensity.compact),
                  child: const Text('Parcelas'),
                ),
              if (onSettle != null)
                FilledButton.tonal(
                  onPressed: onSettle,
                  style: FilledButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                  ),
                  child: Text(settleLabel),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
