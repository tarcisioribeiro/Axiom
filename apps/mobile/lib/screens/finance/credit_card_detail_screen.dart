import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/credit_card_bill.dart';
import '../../providers/finance_providers.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/accent_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import 'credit_card_purchase_form_sheet.dart';

class CreditCardDetailScreen extends ConsumerWidget {
  final int cardId;

  const CreditCardDetailScreen({super.key, required this.cardId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardAsync = ref.watch(creditCardByIdProvider(cardId));
    final billsAsync = ref.watch(creditCardBillsProvider(cardId));

    return Scaffold(
      appBar: AppBar(title: cardAsync.whenOrNull(data: (c) => Text(c.name))),
      floatingActionButton: FloatingActionButton(
        onPressed: () =>
            showCreditCardPurchaseFormSheet(context, cardId: cardId),
        child: const Icon(Icons.add_shopping_cart_outlined),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(creditCardByIdProvider(cardId));
            ref.invalidate(creditCardBillsProvider(cardId));
            await ref.read(creditCardByIdProvider(cardId).future);
          },
          child: cardAsync.when(
            loading: () => const LoadingState(),
            error: (error, _) => Center(child: Text('Erro: $error')),
            data: (card) => ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Theme.of(context).colorScheme.primary,
                        Theme.of(context).colorScheme.tertiary,
                      ],
                    ),
                    borderRadius: AppRadius.lgRadius,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        card.cardNumberMasked ?? '•••• •••• •••• ••••',
                        style:
                            const TextStyle(color: Colors.white, fontSize: 18),
                      ),
                      SizedBox(height: AppSpacing.sm),
                      Text(
                        card.onCardName,
                        style: const TextStyle(color: Colors.white),
                      ),
                      Text(
                        ChoiceLabels.of(ChoiceLabels.cardFlags, card.flag),
                        style: const TextStyle(color: Colors.white70),
                      ),
                      SizedBox(height: AppSpacing.sm),
                      Text(
                        'Disponível: ${AppFormatters.currency(card.availableCredit)} '
                        'de ${AppFormatters.currency(card.creditLimit)}',
                        style: const TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
                SizedBox(height: AppSpacing.md),
                Text('Faturas', style: Theme.of(context).textTheme.titleMedium),
                SizedBox(height: AppSpacing.sm),
                billsAsync.when(
                  loading: () => const LoadingState(
                      variant: LoadingVariant.list, itemCount: 3),
                  error: (error, _) => Text('Erro: $error'),
                  data: (bills) => bills.isEmpty
                      ? const EmptyState(
                          icon: Icons.receipt_outlined,
                          title: 'Nenhuma fatura ainda',
                        )
                      : Column(
                          children: bills
                              .map(
                                (bill) => _BillTile(
                                  bill: bill,
                                  onTap: () => context.push(
                                    '/finance/credit-cards/$cardId/bills/${bill.id}',
                                  ),
                                ),
                              )
                              .toList(),
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

class _BillTile extends StatelessWidget {
  final CreditCardBill bill;
  final VoidCallback onTap;

  const _BillTile({required this.bill, required this.onTap});

  Color _statusColor(BuildContext context) {
    switch (bill.status) {
      case 'paid':
        return context.semanticColors.success;
      case 'overdue':
        return Theme.of(context).colorScheme.error;
      default:
        return context.semanticColors.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = _statusColor(context);
    return InkWell(
      borderRadius: AppRadius.mdRadius,
      onTap: onTap,
      child: AccentCard(
        accentColor: color,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${bill.month}/${bill.year}',
                      style: theme.textTheme.titleSmall),
                  Text(
                    ChoiceLabels.of(ChoiceLabels.billStatuses, bill.status),
                    style: theme.textTheme.bodySmall?.copyWith(color: color),
                  ),
                ],
              ),
            ),
            Text(
              AppFormatters.currency(bill.totalAmount),
              style: theme.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    );
  }
}
