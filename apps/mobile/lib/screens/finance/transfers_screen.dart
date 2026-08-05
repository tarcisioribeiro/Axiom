import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../models/transfer.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/page_header.dart';
import '../../widgets/stat_card.dart';
import 'transfer_form_sheet.dart';

class TransfersScreen extends ConsumerWidget {
  const TransfersScreen({super.key});

  Future<void> _delete(
      BuildContext context, WidgetRef ref, Transfer transfer) async {
    try {
      await ref.read(transfersServiceProvider).delete(transfer.id);
      ref.invalidate(transfersProvider);
      ref.invalidate(accountsProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final transfersAsync = ref.watch(transfersProvider);
    final accountsAsync = ref.watch(accountsProvider);
    final accounts = accountsAsync.valueOrNull ?? const <Account>[];

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: accounts.length < 2
            ? null
            : () => showTransferFormSheet(context, accounts: accounts),
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(transfersProvider);
            await ref.read(transfersProvider.future);
          },
          child: transfersAsync.when(
            loading: () => const LoadingState(variant: LoadingVariant.list),
            error: (error, _) => Center(child: Text('Erro: $error')),
            data: (transfers) {
              final volume = transfers.fold<double>(0, (s, t) => s + t.value);
              final completed =
                  transfers.where((t) => t.status == 'completed').length;
              final pending =
                  transfers.where((t) => t.status == 'pending').length;

              return ListView(
                padding: const EdgeInsets.all(AppSpacing.md),
                children: [
                  AppPageHeader(
                    title: 'Transferências',
                    icon: Icons.swap_horiz_rounded,
                    color: context.semanticColors.success,
                  ),
                  SizedBox(height: AppSpacing.md),
                  Row(
                    children: [
                      Expanded(
                        child: StatCard(
                          title: 'Volume',
                          value: AppFormatters.currency(volume),
                          icon: Icons.swap_horiz_rounded,
                          accent: StatAccent.primary,
                        ),
                      ),
                      SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: StatCard(
                          title: 'Concluídas',
                          value: '$completed',
                          icon: Icons.check_circle_outline,
                          accent: StatAccent.success,
                        ),
                      ),
                      SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: StatCard(
                          title: 'Pendentes',
                          value: '$pending',
                          icon: Icons.schedule_outlined,
                          accent: StatAccent.warning,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: AppSpacing.md),
                  if (transfers.isEmpty)
                    const EmptyState(
                      icon: Icons.swap_horiz_rounded,
                      title: 'Nenhuma transferência registrada',
                    )
                  else
                    ...transfers.map(
                      (transfer) => _TransferTile(
                        transfer: transfer,
                        onEdit: () => showTransferFormSheet(
                          context,
                          existing: transfer,
                          accounts: accounts,
                        ),
                        onDelete: () => _delete(context, ref, transfer),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _TransferTile extends StatelessWidget {
  final Transfer transfer;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _TransferTile({
    required this.transfer,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      margin: EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: AppRadius.mdRadius,
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(transfer.description, style: theme.textTheme.titleSmall),
                Text(
                  '${transfer.originAccountName ?? '—'} → ${transfer.destinyAccountName ?? '—'}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                Text(
                  '${ChoiceLabels.of(ChoiceLabels.transferCategories, transfer.category)} · ${AppFormatters.date(transfer.date)} · '
                  '${ChoiceLabels.of(ChoiceLabels.transferStatuses, transfer.status)}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Text(
            AppFormatters.currency(transfer.value),
            style: theme.textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          IconButton(
            icon: const Icon(Icons.edit_outlined, size: 18),
            onPressed: onEdit,
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 18),
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }
}
