import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/monthly_plan.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_card.dart';
import '../../widgets/feedback.dart';
import '../../widgets/form_sheet_submit_footer.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/month_nav.dart';
import '../../widgets/page_header.dart';
import '../../widgets/stat_card.dart';

/// Planejamento mensal — projeta o mês (fixas, faturas, orçamentos e extras)
/// sobre os dados reais. Edições salvam sozinhas (debounce) em
/// `monthly-plan/<id>/`; "Aplicar" gera as fixas e cria os orçamentos.
/// Mirror simplificado do `MonthlyPlanner` do web (sem histórico por item).
class MonthlyPlannerScreen extends ConsumerStatefulWidget {
  const MonthlyPlannerScreen({super.key});

  @override
  ConsumerState<MonthlyPlannerScreen> createState() =>
      _MonthlyPlannerScreenState();
}

class _MonthlyPlannerScreenState extends ConsumerState<MonthlyPlannerScreen> {
  MonthYear _my = (month: DateTime.now().month, year: DateTime.now().year);
  MonthlyPlan? _plan;
  MonthYear? _planFor;
  Timer? _debounce;
  bool _applying = false;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _edit(MonthlyPlan Function(MonthlyPlan) change) {
    setState(() => _plan = change(_plan!));
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 700), _flush);
  }

  Future<void> _flush() async {
    final plan = _plan;
    if (plan == null) return;
    try {
      await ref.read(monthlyPlanServiceProvider).save(plan.id, plan);
    } on ApiException catch (e) {
      _snack(e.message, kind: ToastKind.error);
    }
  }

  void _snack(String msg, {ToastKind kind = ToastKind.success}) {
    if (mounted) {
      showAppToast(context, msg, kind: kind);
    }
  }

  Future<void> _apply() async {
    final plan = _plan!;
    setState(() => _applying = true);
    _debounce?.cancel();
    try {
      final service = ref.read(monthlyPlanServiceProvider);
      await service.save(plan.id, plan);
      final r = await service.apply(plan.id);
      ref
        ..invalidate(monthlyPlanSummaryProvider(_my))
        ..invalidate(budgetStatusProvider(_my))
        ..invalidate(expensesProvider)
        ..invalidate(revenuesProvider)
        ..invalidate(accountsProvider);
      _snack('Plano aplicado: ${r['revenues_created'] ?? 0} receita(s), '
          '${r['expenses_created'] ?? 0} despesa(s), '
          '${r['budgets_created'] ?? 0} orçamento(s).');
    } on ApiException catch (e) {
      _snack(e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _applying = false);
    }
  }

  double _num(String? v) =>
      double.tryParse((v ?? '').replaceAll(',', '.')) ?? 0;

  @override
  Widget build(BuildContext context) {
    final summaryAsync = ref.watch(monthlyPlanSummaryProvider(_my));
    final summary = summaryAsync.valueOrNull;
    // Adota o plano do servidor quando o mês muda / é recarregado.
    if (summary != null && _planFor != _my) {
      _plan = summary.plan;
      _planFor = _my;
    }

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            _planFor = null;
            ref.invalidate(monthlyPlanSummaryProvider(_my));
            await ref.read(monthlyPlanSummaryProvider(_my).future);
          },
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              AppPageHeader(
                title: 'Planejamento mensal',
                icon: Icons.event_available_outlined,
                color: context.palette.finance,
              ),
              MonthNav(
                month: _my.month,
                year: _my.year,
                onChanged: (m, y) {
                  _debounce?.cancel();
                  _flush();
                  setState(() {
                    _my = (month: m, year: y);
                    _plan = null;
                    _planFor = null;
                  });
                },
              ),
              if (summaryAsync.hasError && summary == null)
                ErrorState(
                  error: summaryAsync.error!,
                  onRetry: () =>
                      ref.invalidate(monthlyPlanSummaryProvider(_my)),
                )
              else if (summary == null || _plan == null)
                const LoadingState(variant: LoadingVariant.list)
              else
                ..._content(context, summary, _plan!),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _content(
      BuildContext context, MonthlyPlanSummary s, MonthlyPlan plan) {
    final theme = Theme.of(context);

    double fixedTotal(List<PlanFixedItem> items, Map<String, FixedOverride> ov,
        {bool skipPostedCard = false}) {
      return items.fold<double>(0, (acc, i) {
        if (skipPostedCard && i.alreadyPosted && i.onCard) return acc;
        final o = i.settled ? null : ov['${i.id}'];
        if (o?.enabled == false) return acc;
        return acc + (o?.value != null ? _num(o!.value) : i.defaultValue);
      });
    }

    double extrasTotal(List<ExtraItem> l) =>
        l.where((e) => e.enabled).fold(0, (a, e) => a + e.amount);

    final categories = {
      ...s.suggestions.map((e) => e.category),
      ...s.existingBudgets.keys,
    }.toList();

    double budgetValue(String c) => plan.budgetOverrides.containsKey(c)
        ? _num(plan.budgetOverrides[c])
        : (s.existingBudgets[c] ?? 0);

    final totalBudgets = categories
        .where((c) => !plan.budgetDisabledCategories.contains(c))
        .fold<double>(0, (a, c) => a + budgetValue(c));
    final totalBills = s.bills
        .where((b) => plan.billOverrides['${b.id}'] != false)
        .fold<double>(0, (a, b) => a + b.total);

    final revenues = fixedTotal(s.fixedRevenues, plan.fixedRevenueOverrides) +
        extrasTotal(plan.extraRevenues) +
        s.openingBalance;
    final expenses = fixedTotal(s.fixedExpenses, plan.fixedExpenseOverrides,
            skipPostedCard: true) +
        totalBills +
        extrasTotal(plan.extraExpenses) +
        totalBudgets +
        s.registeredExpensesNet;
    final balance = revenues - expenses;
    final applied = plan.appliedAt != null;

    return [
      Row(children: [
        Expanded(
          child: StatCard(
            title: 'Receitas',
            value: AppFormatters.currency(revenues),
            icon: Icons.trending_up,
            accent: StatAccent.success,
          ),
        ),
        SizedBox(width: AppSpacing.sm),
        Expanded(
          child: StatCard(
            title: 'Despesas',
            value: AppFormatters.currency(expenses),
            icon: Icons.trending_down,
            accent: StatAccent.destructive,
          ),
        ),
      ]),
      SizedBox(height: AppSpacing.sm),
      StatCard(
        title: 'Saldo projetado',
        value: AppFormatters.currency(balance),
        icon: Icons.account_balance_wallet_outlined,
        accent: balance >= 0 ? StatAccent.primary : StatAccent.destructive,
        description: s.actualRevenues > 0 || s.actualExpenses > 0
            ? 'Realizado: ${AppFormatters.currency(s.actualRevenues - s.actualExpenses)}'
            : null,
      ),
      SizedBox(height: AppSpacing.sm),
      FilledButton.icon(
        onPressed: _applying ? null : _apply,
        icon: _applying
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.check_circle_outline),
        label: Text(applied ? 'Reaplicar plano' : 'Aplicar plano'),
      ),
      _section(context, 'Receitas fixas',
          fixedTotal(s.fixedRevenues, plan.fixedRevenueOverrides), [
        for (final i in s.fixedRevenues)
          _fixedRow(
            i,
            plan.fixedRevenueOverrides['${i.id}'],
            settledLabel: i.settled ? 'Recebida' : null,
            onChange: (o) => _edit((p) => p.copyWith(fixedRevenueOverrides: {
                  ...p.fixedRevenueOverrides,
                  '${i.id}': o
                })),
          ),
      ]),
      _extras(context, 'Receitas extras', plan.extraRevenues, 'income',
          (l) => _edit((p) => p.copyWith(extraRevenues: l))),
      _section(
          context,
          'Despesas fixas',
          fixedTotal(s.fixedExpenses, plan.fixedExpenseOverrides,
              skipPostedCard: true),
          [
            for (final i in s.fixedExpenses)
              _fixedRow(
                i,
                plan.fixedExpenseOverrides['${i.id}'],
                lockedOff: i.alreadyPosted && i.onCard,
                settledLabel: i.settled
                    ? (i.onCard ? 'Lançada' : 'Paga')
                    : (i.alreadyPosted && i.onCard ? 'Lançada' : null),
                onChange: (o) => _edit((p) => p.copyWith(
                        fixedExpenseOverrides: {
                          ...p.fixedExpenseOverrides,
                          '${i.id}': o
                        })),
              ),
          ]),
      _section(context, 'Faturas de cartão', totalBills, [
        for (final b in s.bills)
          SwitchListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            value: plan.billOverrides['${b.id}'] != false,
            onChanged: (v) => _edit((p) =>
                p.copyWith(billOverrides: {...p.billOverrides, '${b.id}': v})),
            title: Text(b.cardName),
            subtitle: Text(b.dueDate == null
                ? ChoiceLabels.of(ChoiceLabels.billStatuses, b.status)
                : 'Vence ${AppFormatters.date(DateTime.parse(b.dueDate!))}'
                    ' · ${ChoiceLabels.of(ChoiceLabels.billStatuses, b.status)}'),
            secondary: Text(AppFormatters.currency(b.total),
                style: theme.textTheme.titleSmall),
          ),
      ]),
      _section(context, 'Orçamentos', totalBudgets, [
        for (final c in categories) _budgetRow(context, s, plan, c),
      ]),
      _extras(context, 'Despesas extras', plan.extraExpenses, 'others',
          (l) => _edit((p) => p.copyWith(extraExpenses: l))),
      SizedBox(height: AppSpacing.lg),
    ];
  }

  Widget _section(
      BuildContext context, String title, double total, List<Widget> children) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.md),
      child: AppCard(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.smd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(child: Text(title, style: theme.textTheme.titleSmall)),
                Text(AppFormatters.currency(total),
                    style: theme.textTheme.titleSmall),
              ]),
              if (children.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.xs),
                  child: Text('Nada por aqui.',
                      style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                )
              else
                ...children,
            ],
          ),
        ),
      ),
    );
  }

  Widget _fixedRow(
    PlanFixedItem i,
    FixedOverride? o, {
    required void Function(FixedOverride) onChange,
    String? settledLabel,
    bool lockedOff = false,
  }) {
    final locked = settledLabel != null;
    final enabled = locked || (!lockedOff && (o?.enabled ?? true));
    return Row(children: [
      Checkbox(
        value: enabled,
        onChanged: locked || lockedOff
            ? null
            : (v) =>
                onChange(FixedOverride(enabled: v ?? true, value: o?.value)),
      ),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(i.description),
          Text(
            'Dia ${i.dueDay}${i.sub.isEmpty ? '' : ' · ${i.sub}'}'
            '${settledLabel == null ? '' : ' · $settledLabel'}',
            style: const TextStyle(fontSize: 12),
          ),
        ]),
      ),
      SizedBox(
        width: 96,
        child: TextFormField(
          key: ValueKey('fx-${i.id}-${_my.month}-${_my.year}-$locked'),
          initialValue: locked
              ? i.defaultValue.toStringAsFixed(2)
              : (o?.value ?? i.defaultValue.toStringAsFixed(2)),
          enabled: enabled && !locked,
          textAlign: TextAlign.end,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(isDense: true),
          onChanged: (v) => onChange(FixedOverride(enabled: enabled, value: v)),
        ),
      ),
    ]);
  }

  Widget _budgetRow(
      BuildContext context, MonthlyPlanSummary s, MonthlyPlan plan, String c) {
    final on = !plan.budgetDisabledCategories.contains(c);
    final suggested = s.suggestions
        .where((e) => e.category == c)
        .map((e) => e.suggested)
        .firstOrNull;
    return Row(children: [
      Checkbox(
        value: on,
        onChanged: (v) => _edit((p) => p.copyWith(
              budgetDisabledCategories: (v ?? true)
                  ? p.budgetDisabledCategories.where((x) => x != c).toList()
                  : [...p.budgetDisabledCategories, c],
            )),
      ),
      Expanded(child: Text(ChoiceLabels.of(ChoiceLabels.expenseCategories, c))),
      SizedBox(
        width: 96,
        child: TextFormField(
          key: ValueKey('bd-$c-${_my.month}-${_my.year}'),
          initialValue: plan.budgetOverrides[c] ??
              s.existingBudgets[c]?.toStringAsFixed(2),
          enabled: on,
          textAlign: TextAlign.end,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            isDense: true,
            hintText: suggested?.toStringAsFixed(0),
          ),
          onChanged: (v) {
            final n = double.tryParse(v.replaceAll(',', '.'));
            // Só persiste valores válidos; o campo segue editável.
            if (v.isEmpty || (n != null && n >= 0)) {
              _edit((p) =>
                  p.copyWith(budgetOverrides: {...p.budgetOverrides, c: v}));
            }
          },
        ),
      ),
    ]);
  }

  Widget _extras(BuildContext context, String title, List<ExtraItem> items,
      String category, void Function(List<ExtraItem>) onChange) {
    return _section(
      context,
      title,
      items.where((e) => e.enabled).fold(0, (a, e) => a + e.amount),
      [
        for (var idx = 0; idx < items.length; idx++)
          SwitchListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            value: items[idx].enabled,
            onChanged: (v) => onChange([
              for (var j = 0; j < items.length; j++)
                j == idx ? items[j].copyWith(enabled: v) : items[j],
            ]),
            title: Text(items[idx].description.isEmpty
                ? '(sem descrição)'
                : items[idx].description),
            subtitle: Text(AppFormatters.currency(items[idx].amount)),
            secondary: PopupMenuButton<int>(
              onSelected: (v) async {
                if (v == 1) {
                  onChange([...items]..removeAt(idx));
                } else {
                  final edited =
                      await _extraSheet(context, items[idx], category);
                  if (edited != null) {
                    onChange([...items]..[idx] = edited);
                  }
                }
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 0, child: Text('Editar')),
                PopupMenuItem(value: 1, child: Text('Remover')),
              ],
            ),
          ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () async {
              final added = await _extraSheet(context, null, category);
              if (added != null) onChange([...items, added]);
            },
            icon: const Icon(Icons.add),
            label: const Text('Adicionar'),
          ),
        ),
      ],
    );
  }

  Future<ExtraItem?> _extraSheet(
      BuildContext context, ExtraItem? existing, String category) {
    final desc = TextEditingController(text: existing?.description ?? '');
    final value = TextEditingController(text: existing?.value ?? '');
    return showModalBottomSheet<ExtraItem>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            left: AppSpacing.md,
            right: AppSpacing.md,
            bottom: AppSpacing.md + MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
                controller: desc,
                decoration: const InputDecoration(labelText: 'Descrição')),
            SizedBox(height: AppSpacing.sm),
            TextField(
              controller: value,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration:
                  const InputDecoration(labelText: 'Valor', prefixText: 'R\$ '),
            ),
            FormSheetSubmitFooter(
              error: null,
              isSaving: false,
              onSubmit: () => Navigator.of(ctx).pop(ExtraItem(
                description: desc.text.trim(),
                value: value.text.trim(),
                category: existing?.category ?? category,
                enabled: existing?.enabled ?? true,
              )),
            ),
          ]),
        ),
      ),
    );
  }
}
