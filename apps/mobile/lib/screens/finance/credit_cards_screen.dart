import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/account.dart';
import '../../models/credit_card.dart';
import '../../providers/finance_providers.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/accent_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/page_header.dart';
import '../../widgets/row_actions.dart';
import '../../widgets/stat_card.dart';
import 'credit_card_form_sheet.dart';

class CreditCardsScreen extends ConsumerWidget {
  const CreditCardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardsAsync = ref.watch(creditCardsProvider);
    final accountsAsync = ref.watch(accountsProvider);
    final accounts = accountsAsync.valueOrNull ?? const <Account>[];

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: accounts.isEmpty
            ? null
            : () => showCreditCardFormSheet(context, accounts: accounts),
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(creditCardsProvider);
            await ref.read(creditCardsProvider.future);
          },
          child: cardsAsync.when(
            loading: () => const LoadingState(variant: LoadingVariant.list),
            error: (error, _) => Center(child: Text('Erro: $error')),
            data: (cards) {
              final totalLimit =
                  cards.fold<double>(0, (s, c) => s + c.creditLimit);
              final usedLimit =
                  cards.fold<double>(0, (s, c) => s + c.usedCredit);

              return ListView(
                padding: const EdgeInsets.all(AppSpacing.md),
                children: [
                  AppPageHeader(
                    title: 'Cartões de Crédito',
                    icon: Icons.credit_card_outlined,
                    color: context.semanticColors.success,
                  ),
                  SizedBox(height: AppSpacing.md),
                  if (cards.isNotEmpty) ...[
                    Row(
                      children: [
                        Expanded(
                          child: StatCard(
                            title: 'Cartões',
                            value: '${cards.length}',
                            icon: Icons.credit_card_outlined,
                            accent: StatAccent.neutral,
                          ),
                        ),
                        SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: StatCard(
                            title: 'Limite usado',
                            value: AppFormatters.currency(usedLimit),
                            description:
                                'de ${AppFormatters.currency(totalLimit)}',
                            icon: Icons.pie_chart_outline_rounded,
                            accent: StatAccent.warning,
                            progress:
                                totalLimit <= 0 ? 0 : usedLimit / totalLimit,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: AppSpacing.md),
                  ],
                  if (cards.isEmpty)
                    const EmptyState(
                      icon: Icons.credit_card_outlined,
                      title: 'Nenhum cartão cadastrado',
                      message: 'Toque em + para adicionar seu primeiro cartão.',
                    )
                  else
                    ...cards.map(
                      (card) => _CreditCardTile(
                        card: card,
                        onTap: () =>
                            context.push('/finance/credit-cards/${card.id}'),
                        onEdit: () => showCreditCardFormSheet(
                          context,
                          existing: card,
                          accounts: accounts,
                        ),
                        onDelete: () async {
                          await ref
                              .read(creditCardsServiceProvider)
                              .delete(card.id);
                          ref.invalidate(creditCardsProvider);
                        },
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

class _CreditCardTile extends StatelessWidget {
  final CreditCard card;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final Future<void> Function() onDelete;

  const _CreditCardTile({
    required this.card,
    required this.onTap,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final overLimit = card.usagePct >= 0.9;
    return InkWell(
      borderRadius: AppRadius.lgRadius,
      onTap: onTap,
      child: AccentCard(
        accentColor: overLimit
            ? theme.colorScheme.error
            : context.semanticColors.warning,
        accentOnTop: true,
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            SizedBox(
              width: 44,
              height: 44,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CircularProgressIndicator(
                    value: card.usagePct,
                    strokeWidth: 4,
                    backgroundColor:
                        theme.colorScheme.primary.withValues(alpha: 0.12),
                  ),
                  Text(
                    '${(card.usagePct * 100).round()}%',
                    style: theme.textTheme.labelSmall,
                  ),
                ],
              ),
            ),
            SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(card.name, style: theme.textTheme.titleSmall),
                  Text(
                    '${ChoiceLabels.of(ChoiceLabels.cardFlags, card.flag)}'
                    '${card.cardNumberMasked != null ? ' · ${card.cardNumberMasked}' : ''}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  Text(
                    'Disponível: ${AppFormatters.currency(card.availableCredit)}',
                    style: theme.textTheme.bodySmall,
                  ),
                  Text(
                    'Vencimento dia ${card.dueDay}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            RowActionsMenu(
              onEdit: onEdit,
              onDelete: onDelete,
              deleteConfirmTitle: 'Excluir cartão',
              deleteConfirmMessage:
                  'Excluir "${card.name}"? Essa ação não pode ser desfeita.',
            ),
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    );
  }
}
