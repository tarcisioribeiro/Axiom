import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/budget.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/feedback.dart';
import '../../widgets/form_sheet_submit_footer.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/month_nav.dart';
import '../../widgets/page_header.dart';
import '../../widgets/row_actions.dart';

/// Orçamentos por categoria: limite vs gasto real do mês (`budgets/status/`).
class BudgetsScreen extends ConsumerStatefulWidget {
  const BudgetsScreen({super.key});

  @override
  ConsumerState<BudgetsScreen> createState() => _BudgetsScreenState();
}

class _BudgetsScreenState extends ConsumerState<BudgetsScreen> {
  MonthYear _my = (month: DateTime.now().month, year: DateTime.now().year);

  Color _color(BuildContext context, String status) {
    final c = context.semanticColors;
    return switch (status) {
      'exceeded' => Theme.of(context).colorScheme.error,
      'warning' => c.warning,
      _ => c.success,
    };
  }

  Future<void> _delete(BudgetStatus b) async {
    try {
      await ref.read(budgetsServiceProvider).delete(b.id);
      if (mounted) showAppToast(context, 'Excluído com sucesso.');
      ref.invalidate(budgetStatusProvider(_my));
    } on ApiException catch (e) {
      if (mounted) {
        showAppToast(context, e.message, kind: ToastKind.error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(budgetStatusProvider(_my));
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showForm(context),
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(budgetStatusProvider(_my));
            await ref.read(budgetStatusProvider(_my).future);
          },
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              AppPageHeader(
                title: 'Orçamentos',
                subtitle: 'Limite por categoria',
                icon: Icons.pie_chart_outline_rounded,
                color: context.palette.finance,
              ),
              MonthNav(
                month: _my.month,
                year: _my.year,
                onChanged: (m, y) => setState(() => _my = (month: m, year: y)),
              ),
              async.when(
                loading: () => const LoadingState(variant: LoadingVariant.list),
                error: (e, _) => ErrorState(
                    error: e,
                    onRetry: () => ref.invalidate(budgetStatusProvider(_my))),
                data: (items) => items.isEmpty
                    ? const EmptyState(
                        icon: Icons.pie_chart_outline_rounded,
                        title: 'Nenhum orçamento neste mês',
                      )
                    : Column(
                        children: [
                          for (final b in items) _tile(context, b),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tile(BuildContext context, BudgetStatus b) {
    final theme = Theme.of(context);
    final color = _color(context, b.status);
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      accentColor: color,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.smd, AppSpacing.smd, AppSpacing.xs, AppSpacing.smd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                child: Text(
                  ChoiceLabels.of(ChoiceLabels.expenseCategories, b.category),
                  style: theme.textTheme.titleSmall,
                ),
              ),
              Text('${AppFormatters.number(b.percentage.round())}%',
                  style: theme.textTheme.labelLarge?.copyWith(color: color)),
              RowActionsMenu(
                onEdit: () => _showForm(context, existing: b),
                onDelete: () => _delete(b),
                deleteConfirmTitle: 'Excluir orçamento',
                deleteConfirmMessage:
                    'Excluir o orçamento de "${ChoiceLabels.of(ChoiceLabels.expenseCategories, b.category)}"?',
              ),
            ]),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: (b.percentage / 100).clamp(0, 1),
                minHeight: 6,
                color: color,
                backgroundColor: theme.colorScheme.surfaceContainerHighest,
              ),
            ),
            SizedBox(height: AppSpacing.xs),
            Text(
              '${AppFormatters.currency(b.actualSpent)} de '
              '${AppFormatters.currency(b.effectiveLimit)}'
              ' · ${ChoiceLabels.of(ChoiceLabels.budgetStatuses, b.status)}',
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }

  void _showForm(BuildContext context, {BudgetStatus? existing}) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _BudgetForm(my: _my, existing: existing),
    ).then((_) => ref.invalidate(budgetStatusProvider(_my)));
  }
}

class _BudgetForm extends ConsumerStatefulWidget {
  final MonthYear my;
  final BudgetStatus? existing;
  const _BudgetForm({required this.my, this.existing});

  @override
  ConsumerState<_BudgetForm> createState() => _BudgetFormState();
}

class _BudgetFormState extends ConsumerState<_BudgetForm> {
  late String _category = widget.existing?.category ?? 'food and drink';
  late final _limit = TextEditingController(
      text: widget.existing?.limitAmount.toStringAsFixed(2) ?? '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _limit.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final value = double.tryParse(_limit.text.replaceAll(',', '.'));
    if (value == null || value <= 0) {
      setState(() => _error = 'Informe um limite maior que zero.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final service = ref.read(budgetsServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create({
          'category': _category,
          'limit_amount': value,
          'month': widget.my.month,
          'year': widget.my.year,
        });
      } else {
        await service.patch(widget.existing!.id, {'limit_amount': value});
      }
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          bottom: AppSpacing.md + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.existing == null ? 'Novo orçamento' : 'Editar limite',
                style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _category,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Categoria'),
              items: ChoiceLabels.expenseCategories.entries
                  .map((e) =>
                      DropdownMenuItem(value: e.key, child: Text(e.value)))
                  .toList(),
              onChanged: widget.existing == null
                  ? (v) => setState(() => _category = v!)
                  : null,
            ),
            SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _limit,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                  labelText: 'Limite mensal', prefixText: 'R\$ '),
            ),
            FormSheetSubmitFooter(
                error: _error, isSaving: _saving, onSubmit: _save),
            SizedBox(height: AppSpacing.sm),
          ],
        ),
      ),
    );
  }
}
