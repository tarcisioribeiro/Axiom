import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/accent_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/page_header.dart';
import '../../widgets/stat_card.dart';
import 'account_form_sheet.dart';

class AccountsScreen extends ConsumerWidget {
  const AccountsScreen({super.key});

  Future<void> _delete(
      BuildContext context, WidgetRef ref, Account account) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Excluir conta'),
        content: Text(
            'Excluir "${account.accountName}"? Essa ação não pode ser desfeita.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(accountsServiceProvider).delete(account.id);
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
    final accountsAsync = ref.watch(accountsProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => showAccountFormSheet(context),
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(accountsProvider);
            await ref.read(accountsProvider.future);
          },
          child: accountsAsync.when(
            loading: () => const LoadingState(variant: LoadingVariant.list),
            error: (error, _) => Center(child: Text('Erro: $error')),
            data: (accounts) => ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                AppPageHeader(
                  title: 'Contas',
                  icon: Icons.account_balance_wallet_outlined,
                  color: context.semanticColors.success,
                ),
                SizedBox(height: AppSpacing.md),
                if (accounts.isNotEmpty) ...[
                  Row(
                    children: [
                      Expanded(
                        child: StatCard(
                          title: 'Saldo total',
                          value: AppFormatters.currency(
                            accounts.fold<double>(0, (s, a) => s + a.balance),
                          ),
                          icon: Icons.account_balance_wallet_rounded,
                          accent: StatAccent.primary,
                        ),
                      ),
                      SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: StatCard(
                          title: 'Contas',
                          value: '${accounts.length}',
                          icon: Icons.dashboard_outlined,
                          accent: StatAccent.neutral,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: AppSpacing.md),
                ],
                if (accounts.isEmpty)
                  EmptyState(
                    icon: Icons.account_balance_wallet_outlined,
                    title: 'Nenhuma conta cadastrada',
                    message: 'Toque em + para adicionar sua primeira conta.',
                  )
                else
                  ...accounts.map(
                    (account) => _AccountCard(
                      account: account,
                      onEdit: () =>
                          showAccountFormSheet(context, existing: account),
                      onDelete: () => _delete(context, ref, account),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AccountCard extends StatelessWidget {
  final Account account;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _AccountCard({
    required this.account,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AccentCard(
      accentColor: theme.colorScheme.primary,
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.12),
            child: Text(
              account.accountName.isNotEmpty
                  ? account.accountName[0].toUpperCase()
                  : '?',
              style: TextStyle(color: theme.colorScheme.primary),
            ),
          ),
          SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(account.accountName, style: theme.textTheme.titleSmall),
                Text(
                  '${ChoiceLabels.of(ChoiceLabels.institutions, account.institution)}'
                  ' · ${ChoiceLabels.of(ChoiceLabels.accountTypes, account.accountType)}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                if (account.accountNumberMasked != null)
                  Text(
                    account.accountNumberMasked!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                SizedBox(height: AppSpacing.xs),
                Text(
                  AppFormatters.currency(account.balance),
                  style: theme.textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.edit_outlined, size: 20),
            onPressed: onEdit,
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 20),
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }
}
