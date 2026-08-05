import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/credit_card_bill.dart';
import '../../models/credit_card_installment.dart';
import '../../providers/finance_providers.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/stat_card.dart';

class CreditCardBillDetailScreen extends ConsumerWidget {
  final int billId;

  const CreditCardBillDetailScreen({super.key, required this.billId});

  Future<void> _pay(
      BuildContext context, WidgetRef ref, CreditCardBill bill) async {
    final amountController =
        TextEditingController(text: bill.remaining.toStringAsFixed(2));
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Pagar fatura'),
        content: TextField(
          controller: amountController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Valor a pagar'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Pagar'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final amount =
        double.tryParse(amountController.text.replaceAll(',', '.')) ?? 0;
    await ref
        .read(creditCardBillsServiceProvider)
        .pay(bill.id, amount: amount, paymentDate: DateTime.now());
    ref.invalidate(creditCardBillByIdProvider(billId));
    ref.invalidate(creditCardBillItemsProvider(billId));
    ref.invalidate(creditCardBillsProvider(bill.creditCard));
  }

  Future<void> _reopen(WidgetRef ref, CreditCardBill bill) async {
    await ref.read(creditCardBillsServiceProvider).reopen(bill.id);
    ref.invalidate(creditCardBillByIdProvider(billId));
    ref.invalidate(creditCardBillsProvider(bill.creditCard));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final billAsync = ref.watch(creditCardBillByIdProvider(billId));
    final itemsAsync = ref.watch(creditCardBillItemsProvider(billId));

    return Scaffold(
      appBar: AppBar(
        title: billAsync.whenOrNull(
          data: (bill) => Text('Fatura ${bill.month}/${bill.year}'),
        ),
      ),
      body: SafeArea(
        child: billAsync.when(
          loading: () => const LoadingState(),
          error: (error, _) => Center(child: Text('Erro: $error')),
          data: (bill) => ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Row(
                children: [
                  Expanded(
                    child: StatCard(
                      title: 'Total',
                      value: AppFormatters.currency(bill.totalAmount),
                      icon: Icons.receipt_long_outlined,
                      accent: StatAccent.neutral,
                    ),
                  ),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: StatCard(
                      title: 'Restante',
                      value: AppFormatters.currency(bill.remaining),
                      icon: Icons.schedule_outlined,
                      accent: bill.status == 'paid'
                          ? StatAccent.success
                          : StatAccent.warning,
                    ),
                  ),
                ],
              ),
              SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                children: [
                  if (bill.status != 'paid')
                    FilledButton.icon(
                      onPressed: () => _pay(context, ref, bill),
                      icon: const Icon(Icons.payments_outlined, size: 18),
                      label: const Text('Pagar'),
                    ),
                  if (bill.status == 'paid' || bill.status == 'closed')
                    OutlinedButton.icon(
                      onPressed: () => _reopen(ref, bill),
                      icon: const Icon(Icons.lock_open_outlined, size: 18),
                      label: const Text('Reabrir'),
                    ),
                ],
              ),
              SizedBox(height: AppSpacing.md),
              Text('Parcelas', style: Theme.of(context).textTheme.titleMedium),
              SizedBox(height: AppSpacing.sm),
              itemsAsync.when(
                loading: () => const LoadingState(
                    variant: LoadingVariant.list, itemCount: 3),
                error: (error, _) => Text('Erro: $error'),
                data: (items) => items.isEmpty
                    ? const EmptyState(
                        icon: Icons.list_alt_outlined,
                        title: 'Nenhuma parcela nesta fatura',
                      )
                    : Column(
                        children: items.map(_InstallmentTile.new).toList()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InstallmentTile extends StatelessWidget {
  final CreditCardInstallment installment;

  const _InstallmentTile(this.installment);

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
                Text(
                  installment.description ??
                      'Parcela ${installment.installmentNumber}',
                  style: theme.textTheme.titleSmall,
                ),
                Text(
                  '${installment.installmentNumber}/${installment.totalInstallments ?? '?'}'
                  '${installment.category != null ? ' · ${ChoiceLabels.of(ChoiceLabels.expenseCategories, installment.category)}' : ''}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                AppFormatters.currency(installment.value),
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              Icon(
                installment.payed
                    ? Icons.check_circle
                    : Icons.schedule_outlined,
                size: 16,
                color: installment.payed
                    ? context.semanticColors.success
                    : context.semanticColors.warning,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
