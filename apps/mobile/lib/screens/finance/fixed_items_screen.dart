import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../models/credit_card.dart';
import '../../models/fixed_item.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../services/fixed_items_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/form_sheet_submit_footer.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/page_header.dart';
import '../../widgets/row_actions.dart';

/// Despesas e receitas fixas (templates recorrentes) — mirror de
/// `FixedExpenses`/`FixedRevenues` do web: CRUD + "Lançar no mês".
class FixedItemsScreen extends StatelessWidget {
  const FixedItemsScreen({super.key});

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
                    AppSpacing.md, AppSpacing.md, AppSpacing.md, 0),
                child: AppPageHeader(
                  title: 'Fixas',
                  subtitle: 'Despesas e receitas recorrentes',
                  icon: Icons.event_repeat_outlined,
                  color: context.semanticColors.success,
                ),
              ),
              const TabBar(
                tabs: [Tab(text: 'Despesas'), Tab(text: 'Receitas')],
              ),
              const Expanded(
                child: TabBarView(
                  children: [
                    _FixedTab(isExpense: true),
                    _FixedTab(isExpense: false),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FixedTab extends ConsumerWidget {
  final bool isExpense;
  const _FixedTab({required this.isExpense});

  AutoDisposeFutureProvider<List<FixedItem>> get _provider =>
      isExpense ? fixedExpensesProvider : fixedRevenuesProvider;

  dynamic _service(WidgetRef ref) => ref.read(
      isExpense ? fixedExpensesServiceProvider : fixedRevenuesServiceProvider);

  Future<void> _run(BuildContext context, Future<void> Function() fn) async {
    try {
      await fn();
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_provider);
    final accounts = ref.watch(accountsProvider).valueOrNull ?? const [];
    final cards = ref.watch(creditCardsProvider).valueOrNull ?? const [];

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => showFixedItemFormSheet(
          context,
          isExpense: isExpense,
          accounts: accounts,
          cards: cards,
        ),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_provider);
          await ref.read(_provider.future);
        },
        child: async.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (e, _) => Center(child: Text('Erro: $e')),
          data: (items) {
            final active = items.where((i) => i.isActive).toList();
            final total = active.fold<double>(0, (s, i) => s + i.defaultValue);
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Total mensal ativo: ${AppFormatters.currency(total)}',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: active.isEmpty
                          ? null
                          : () => showLaunchFixedSheet(
                                context,
                                isExpense: isExpense,
                                items: active,
                              ),
                      icon: const Icon(Icons.play_arrow_rounded),
                      label: const Text('Lançar'),
                    ),
                  ],
                ),
                SizedBox(height: AppSpacing.sm),
                if (items.isEmpty)
                  EmptyState(
                    icon: Icons.event_repeat_outlined,
                    title: isExpense
                        ? 'Nenhuma despesa fixa'
                        : 'Nenhuma receita fixa',
                  )
                else
                  for (final i in items)
                    AppCard(
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(i.description),
                        subtitle: Text(
                          '${AppFormatters.currency(i.defaultValue)} · dia ${i.dueDay}'
                          ' · ${i.creditCardName ?? i.accountName ?? ''}',
                        ),
                        leading: Switch(
                          value: i.isActive,
                          onChanged: (v) => _run(context, () async {
                            await _service(ref).patch(i.id, {'is_active': v});
                            ref.invalidate(_provider);
                          }),
                        ),
                        trailing: RowActionsMenu(
                          onEdit: () => showFixedItemFormSheet(
                            context,
                            isExpense: isExpense,
                            existing: i,
                            accounts: accounts,
                            cards: cards,
                          ),
                          onDelete: () => _run(context, () async {
                            await _service(ref).delete(i.id);
                            ref.invalidate(_provider);
                          }),
                          deleteConfirmTitle: 'Excluir fixa',
                          deleteConfirmMessage:
                              'Excluir "${i.description}"? Lançamentos já gerados são mantidos.',
                        ),
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

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

Future<bool?> showFixedItemFormSheet(
  BuildContext context, {
  required bool isExpense,
  FixedItem? existing,
  required List<Account> accounts,
  required List<CreditCard> cards,
}) =>
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _FixedForm(
        isExpense: isExpense,
        existing: existing,
        accounts: accounts,
        cards: cards,
      ),
    );

class _FixedForm extends ConsumerStatefulWidget {
  final bool isExpense;
  final FixedItem? existing;
  final List<Account> accounts;
  final List<CreditCard> cards;
  const _FixedForm({
    required this.isExpense,
    required this.existing,
    required this.accounts,
    required this.cards,
  });

  @override
  ConsumerState<_FixedForm> createState() => _FixedFormState();
}

class _FixedFormState extends ConsumerState<_FixedForm> {
  final _formKey = GlobalKey<FormState>();
  late final _description =
      TextEditingController(text: widget.existing?.description ?? '');
  late final _value = TextEditingController(
      text: widget.existing?.defaultValue.toStringAsFixed(2) ?? '');
  late final _dueDay =
      TextEditingController(text: '${widget.existing?.dueDay ?? 1}');
  late String _category = widget.existing?.category ??
      (widget.isExpense ? 'bills and services' : 'salary');
  int? _accountId;
  int? _cardId;
  late bool _allowEdit = widget.existing?.allowValueEdit ?? true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _accountId = e?.account ??
        (e == null && widget.accounts.isNotEmpty
            ? widget.accounts.first.id
            : null);
    _cardId = e?.creditCard;
  }

  @override
  void dispose() {
    _description.dispose();
    _value.dispose();
    _dueDay.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final item = FixedItem(
      id: widget.existing?.id ?? 0,
      description: _description.text.trim(),
      defaultValue: double.tryParse(_value.text.replaceAll(',', '.')) ?? 0,
      category: _category,
      // Conta e cartão são mutuamente exclusivos na API.
      account: _cardId == null ? _accountId : null,
      creditCard: _cardId,
      dueDay: int.tryParse(_dueDay.text) ?? 1,
      isActive: widget.existing?.isActive ?? true,
      allowValueEdit: _allowEdit,
    );
    final service = ref.read(widget.isExpense
        ? fixedExpensesServiceProvider
        : fixedRevenuesServiceProvider);
    try {
      final body = item.toJson();
      if (!widget.isExpense) body.remove('credit_card');
      if (widget.existing == null) {
        await service.create(body);
      } else {
        await service.patch(widget.existing!.id, body);
      }
      ref.invalidate(
          widget.isExpense ? fixedExpensesProvider : fixedRevenuesProvider);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final categories = widget.isExpense
        ? ChoiceLabels.expenseCategories
        : ChoiceLabels.revenueCategories;
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          bottom: AppSpacing.md + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${widget.existing == null ? 'Nova' : 'Editar'} '
                '${widget.isExpense ? 'despesa' : 'receita'} fixa',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _description,
                decoration: const InputDecoration(labelText: 'Descrição'),
                validator: (v) => (v == null || v.trim().isEmpty)
                    ? 'Informe a descrição'
                    : null,
              ),
              SizedBox(height: AppSpacing.sm),
              Row(children: [
                Expanded(
                  child: TextFormField(
                    controller: _value,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Valor'),
                    validator: (v) =>
                        (v == null || v.isEmpty) ? 'Informe o valor' : null,
                  ),
                ),
                SizedBox(width: AppSpacing.sm),
                SizedBox(
                  width: 110,
                  child: TextFormField(
                    controller: _dueDay,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Dia (1-31)'),
                    validator: (v) {
                      final n = int.tryParse(v ?? '');
                      return (n == null || n < 1 || n > 31) ? '1 a 31' : null;
                    },
                  ),
                ),
              ]),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                initialValue: categories.containsKey(_category)
                    ? _category
                    : categories.keys.first,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Categoria'),
                items: categories.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _category = v!),
              ),
              SizedBox(height: AppSpacing.sm),
              if (widget.isExpense && widget.cards.isNotEmpty)
                DropdownButtonFormField<int?>(
                  initialValue: _cardId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                      labelText: 'Cartão (opcional — senão, usa a conta)'),
                  items: [
                    const DropdownMenuItem<int?>(
                        value: null, child: Text('Débito em conta')),
                    ...widget.cards.map((c) => DropdownMenuItem<int?>(
                        value: c.id, child: Text(c.name))),
                  ],
                  onChanged: (v) => setState(() => _cardId = v),
                ),
              if (_cardId == null) ...[
                SizedBox(height: AppSpacing.sm),
                DropdownButtonFormField<int>(
                  initialValue: _accountId,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Conta'),
                  items: widget.accounts
                      .map((a) => DropdownMenuItem(
                          value: a.id, child: Text(a.accountName)))
                      .toList(),
                  onChanged: (v) => setState(() => _accountId = v),
                  validator: (v) => v == null ? 'Selecione uma conta' : null,
                ),
              ],
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Permitir editar o valor ao lançar'),
                value: _allowEdit,
                onChanged: (v) => setState(() => _allowEdit = v),
              ),
              FormSheetSubmitFooter(
                  error: _error, isSaving: _saving, onSubmit: _save),
              SizedBox(height: AppSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Lançar no mês
// ---------------------------------------------------------------------------

Future<void> showLaunchFixedSheet(
  BuildContext context, {
  required bool isExpense,
  required List<FixedItem> items,
}) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _LaunchSheet(isExpense: isExpense, items: items),
    );

class _LaunchSheet extends ConsumerStatefulWidget {
  final bool isExpense;
  final List<FixedItem> items;
  const _LaunchSheet({required this.isExpense, required this.items});

  @override
  ConsumerState<_LaunchSheet> createState() => _LaunchSheetState();
}

class _LaunchSheetState extends ConsumerState<_LaunchSheet> {
  late final Set<int> _selected = widget.items.map((i) => i.id).toSet();
  late final Map<int, TextEditingController> _values = {
    for (final i in widget.items)
      i.id: TextEditingController(text: i.defaultValue.toStringAsFixed(2)),
  };
  String? _month;
  bool _saving = false;
  String? _error;

  /// Mês corrente + 3 próximos, removendo os já totalmente lançados.
  List<String> _options(List<String> done) {
    final now = DateTime.now();
    return [
      for (var i = 0; i < 4; i++)
        () {
          final d = DateTime(now.year, now.month + i);
          return '${d.year}-${d.month.toString().padLeft(2, '0')}';
        }(),
    ].where((m) => !done.contains(m)).toList();
  }

  @override
  void dispose() {
    for (final c in _values.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _launch(FixedItemsService service, String month) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final values = {
        for (final i in widget.items.where((i) => _selected.contains(i.id)))
          i.id: double.tryParse(_values[i.id]!.text.replaceAll(',', '.')) ??
              i.defaultValue,
      };
      final created = await service.generate(month, values);
      // Lançar cria despesas/receitas reais: atualiza as listas afetadas.
      ref
        ..invalidate(expensesProvider)
        ..invalidate(revenuesProvider)
        ..invalidate(accountsProvider)
        ..invalidate(
            widget.isExpense ? fixedExpensesProvider : fixedRevenuesProvider);
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('$created lançamento(s) criado(s).')));
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final service = ref.watch(widget.isExpense
        ? fixedExpensesServiceProvider
        : fixedRevenuesServiceProvider);
    final done =
        ref.watch(fixedGeneratedMonthsProvider(widget.isExpense)).valueOrNull ??
            const <String>[];
    final options = _options(done);
    final month = options.contains(_month) ? _month : options.firstOrNull;

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
            Text(
              'Lançar ${widget.isExpense ? 'despesas' : 'receitas'} fixas',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            SizedBox(height: AppSpacing.sm),
            if (options.isEmpty)
              const Text('Todos os meses próximos já foram lançados.')
            else ...[
              DropdownButtonFormField<String>(
                initialValue: month,
                decoration: const InputDecoration(labelText: 'Mês'),
                items: options.map((m) {
                  final p = m.split('-');
                  return DropdownMenuItem(
                    value: m,
                    child: Text(
                        '${ChoiceLabels.monthNames[int.parse(p[1]) - 1]} ${p[0]}'),
                  );
                }).toList(),
                onChanged: (v) => setState(() => _month = v),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final i in widget.items)
                      CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        value: _selected.contains(i.id),
                        onChanged: (c) => setState(() => (c ?? false)
                            ? _selected.add(i.id)
                            : _selected.remove(i.id)),
                        title: Text(i.description),
                        subtitle: Text('Dia ${i.dueDay}'),
                        secondary: SizedBox(
                          width: 90,
                          child: TextField(
                            controller: _values[i.id],
                            enabled:
                                i.allowValueEdit && _selected.contains(i.id),
                            textAlign: TextAlign.end,
                            keyboardType: const TextInputType.numberWithOptions(
                                decimal: true),
                            decoration: const InputDecoration(
                                isDense: true, prefixText: 'R\$ '),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
            FormSheetSubmitFooter(
              error: _error,
              isSaving: _saving,
              label: 'Lançar ${_selected.length}',
              onSubmit: month == null || _selected.isEmpty
                  ? null
                  : () => _launch(service, month),
            ),
            SizedBox(height: AppSpacing.sm),
          ],
        ),
      ),
    );
  }
}
