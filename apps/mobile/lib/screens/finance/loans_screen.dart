import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../models/loan.dart';
import '../../models/member.dart';
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
import 'loan_form_sheet.dart';
import 'settle_form_sheet.dart';

/// Empréstimos — money lent to / borrowed from members. Mirrors the web's
/// `Loans` page (the daily-use subset: list, create, settle). Amortization
/// tables, renegotiation and payment-plan tooling stay on the web app.
class LoansScreen extends ConsumerWidget {
  const LoansScreen({super.key});

  Future<void> _delete(BuildContext context, WidgetRef ref, Loan loan) async {
    try {
      await ref.read(loansServiceProvider).delete(loan.id);
      ref.invalidate(loansProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _settle(BuildContext context, WidgetRef ref, Loan loan,
      List<Account> accounts) async {
    if (accounts.isEmpty) return;
    final isReceipt = loan.loanType == 'lent';
    await showSettleFormSheet(
      context,
      title: '${isReceipt ? 'Registrar recebimento' : 'Registrar pagamento'} '
          '— ${loan.description}',
      actionLabel: isReceipt ? 'Receber' : 'Pagar',
      suggestedValue: loan.remainingBalance,
      accounts: accounts,
      onConfirm: ({
        required value,
        required accountId,
        required date,
        notes,
      }) async {
        await ref.read(loansServiceProvider).settle(
              loan.id,
              isReceipt: isReceipt,
              value: value,
              accountId: accountId,
              date: date,
              notes: notes,
            );
        ref.invalidate(loansProvider);
        ref.invalidate(accountsProvider);
        ref.invalidate(expensesProvider);
        ref.invalidate(revenuesProvider);
      },
    );
  }

  Future<void> _openForm(
    BuildContext context,
    WidgetRef ref, {
    Loan? existing,
  }) async {
    final accounts =
        ref.read(accountsProvider).valueOrNull ?? const <Account>[];
    final members = ref.read(membersProvider).valueOrNull ?? const <Member>[];
    final currentMember = ref.read(currentMemberProvider).valueOrNull;
    if (accounts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cadastre uma conta primeiro.')),
      );
      return;
    }
    await showLoanFormSheet(
      context,
      existing: existing,
      accounts: accounts,
      members: members,
      currentMember: currentMember,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loansAsync = ref.watch(loansProvider);
    final accounts = ref.watch(accountsProvider).valueOrNull ?? const [];
    // Kept warm so the form sheet has them ready.
    ref.watch(membersProvider);
    ref.watch(currentMemberProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(context, ref),
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(loansProvider);
            await ref.read(loansProvider.future);
          },
          child: loansAsync.when(
            loading: () => const LoadingState(variant: LoadingVariant.list),
            error: (e, _) => Center(child: Text('Erro: $e')),
            data: (loans) {
              final lentOut = loans
                  .where((l) => l.loanType == 'lent')
                  .fold<double>(0, (s, l) => s + l.remainingBalance);
              final borrowedOut = loans
                  .where((l) => l.loanType == 'borrowed')
                  .fold<double>(0, (s, l) => s + l.remainingBalance);

              return ListView(
                padding: const EdgeInsets.all(AppSpacing.md),
                children: [
                  AppPageHeader(
                    title: 'Empréstimos',
                    icon: Icons.handshake_outlined,
                    color: context.semanticColors.success,
                  ),
                  SizedBox(height: AppSpacing.md),
                  Row(
                    children: [
                      Expanded(
                        child: StatCard(
                          title: 'A receber',
                          value: AppFormatters.currency(lentOut),
                          icon: Icons.trending_up_rounded,
                          accent: StatAccent.success,
                        ),
                      ),
                      SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: StatCard(
                          title: 'A pagar',
                          value: AppFormatters.currency(borrowedOut),
                          icon: Icons.trending_down_rounded,
                          accent: StatAccent.destructive,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: AppSpacing.md),
                  if (loans.isEmpty)
                    const EmptyState(
                      icon: Icons.handshake_outlined,
                      title: 'Nenhum empréstimo registrado',
                    )
                  else
                    ...loans.map(
                      (loan) => _LoanTile(
                        loan: loan,
                        onSettle: loan.remainingBalance <= 0
                            ? null
                            : () => _settle(context, ref, loan, accounts),
                        onInstallments: loan.installments <= 1
                            ? null
                            : () => showInstallmentsSheet(
                                  context,
                                  title: 'Parcelas — ${loan.description}',
                                  load: () => ref
                                      .read(loansServiceProvider)
                                      .installments(loan.id),
                                ),
                        onEdit: () => _openForm(context, ref, existing: loan),
                        onDelete: () => _delete(context, ref, loan),
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

class _LoanTile extends StatelessWidget {
  final Loan loan;
  final VoidCallback? onSettle;
  final VoidCallback? onInstallments;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _LoanTile({
    required this.loan,
    required this.onSettle,
    required this.onInstallments,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isLent = loan.loanType == 'lent';
    final counterparty =
        (isLent ? loan.benefitedName : loan.creditorName) ?? '—';
    final settleLabel = isLent ? 'Receber' : 'Pagar';

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
              Icon(
                isLent ? Icons.call_made_rounded : Icons.call_received_rounded,
                size: 18,
                color: isLent
                    ? context.semanticColors.success
                    : theme.colorScheme.error,
              ),
              SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(loan.description, style: theme.textTheme.titleSmall),
                    Text(
                      '${ChoiceLabels.of(ChoiceLabels.loanTypes, loan.loanType)} · '
                      '$counterparty · ${loan.installments}x · '
                      '${ChoiceLabels.of(ChoiceLabels.loanStatuses, loan.status)}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(width: AppSpacing.sm),
              Text(
                AppFormatters.currency(loan.value),
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              RowActionsMenu(
                onEdit: onEdit,
                onDelete: onDelete,
                deleteConfirmTitle: 'Excluir empréstimo',
                deleteConfirmMessage:
                    'Excluir "${loan.description}"? Essa ação não pode ser desfeita.',
              ),
            ],
          ),
          SizedBox(height: AppSpacing.xs),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: loan.progress,
              minHeight: 6,
              backgroundColor: theme.colorScheme.surfaceContainerHighest,
            ),
          ),
          SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Resta ${AppFormatters.currency(loan.remainingBalance)}',
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
