import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/food.dart';
import '../../models/menu_option.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';
import '../../widgets/app_card.dart';
import '../../widgets/confirm.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/row_actions.dart';

/// Nested editing of a meal type: its menu options, and the ingredients
/// inside each option. Reached from the "Tipos" tab of the Nutrição screen.
class MealTypeDetailScreen extends ConsumerWidget {
  final int mealTypeId;
  final String mealTypeName;

  const MealTypeDetailScreen({
    super.key,
    required this.mealTypeId,
    required this.mealTypeName,
  });

  Future<void> _deleteOption(
      BuildContext context, WidgetRef ref, MenuOption option) async {
    try {
      await ref.read(menuOptionsServiceProvider).delete(option.id);
      ref.invalidate(menuOptionsProvider(mealTypeId));
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final optionsAsync = ref.watch(menuOptionsProvider(mealTypeId));
    ref.watch(foodsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(mealTypeName)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showOptionForm(context, ref, mealTypeId),
        icon: const Icon(Icons.add),
        label: const Text('Opção'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(menuOptionsProvider(mealTypeId));
          await ref.read(menuOptionsProvider(mealTypeId).future);
        },
        child: optionsAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (e, _) => Center(child: Text('Erro: $e')),
          data: (options) {
            if (options.isEmpty) {
              return const EmptyState(
                icon: Icons.restaurant_menu_outlined,
                title: 'Nenhuma opção neste tipo de refeição',
              );
            }
            final sorted = [...options]
              ..sort((a, b) => a.order.compareTo(b.order));
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: sorted
                  .map((o) => _OptionCard(
                        option: o,
                        mealTypeId: mealTypeId,
                        onEdit: () => _showOptionForm(context, ref, mealTypeId,
                            existing: o),
                        onDelete: () => _deleteOption(context, ref, o),
                      ))
                  .toList(),
            );
          },
        ),
      ),
    );
  }
}

class _OptionCard extends ConsumerWidget {
  final MenuOption option;
  final int mealTypeId;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _OptionCard({
    required this.option,
    required this.mealTypeId,
    required this.onEdit,
    required this.onDelete,
  });

  Future<void> _deleteIngredient(
      BuildContext context, WidgetRef ref, MenuOptionIngredient ing) async {
    try {
      await ref.read(menuOptionIngredientsServiceProvider).delete(ing.id);
      ref.invalidate(menuOptionsProvider(mealTypeId));
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final foods = ref.watch(foodsProvider).valueOrNull ?? const <Food>[];

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.smd,
        AppSpacing.xs,
        AppSpacing.sm,
        AppSpacing.smd,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(option.name, style: theme.textTheme.titleSmall),
              ),
              RowActionsMenu(
                onEdit: onEdit,
                onDelete: onDelete,
                deleteConfirmTitle: 'Excluir opção',
                deleteConfirmMessage:
                    'Excluir "${option.name}" e seus ingredientes?',
              ),
            ],
          ),
          const Divider(height: AppSpacing.md),
          if (option.ingredients.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Text('Nenhum ingrediente',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  )),
            )
          else
            ...option.ingredients.map((ing) => Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${ing.foodName ?? 'Alimento'} · '
                          '${_qty(ing.quantity)} '
                          '${ChoiceLabels.of(ChoiceLabels.measurementUnits, ing.unit)}'
                          '${ing.isOptional ? ' (opcional)' : ''}',
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                      InkWell(
                        onTap: () => _showIngredientForm(
                          context,
                          ref,
                          option.id,
                          mealTypeId: mealTypeId,
                          foods: foods,
                          existing: ing,
                        ),
                        child: const Padding(
                          padding: EdgeInsets.all(4),
                          child: Icon(Icons.edit_outlined, size: 16),
                        ),
                      ),
                      InkWell(
                        onTap: () async {
                          final ok = await confirmDelete(context,
                              title: 'Excluir ingrediente',
                              message:
                                  'Remover "${ing.foodName ?? 'ingrediente'}"?');
                          if (ok) {
                            await _deleteIngredient(context, ref, ing);
                          }
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: Icon(Icons.delete_outline,
                              size: 16, color: theme.colorScheme.error),
                        ),
                      ),
                    ],
                  ),
                )),
          SizedBox(height: AppSpacing.xs),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: foods.isEmpty
                  ? null
                  : () => _showIngredientForm(context, ref, option.id,
                      mealTypeId: mealTypeId, foods: foods),
              icon: const Icon(Icons.add, size: 16),
              label: Text(foods.isEmpty
                  ? 'Cadastre alimentos primeiro'
                  : 'Ingrediente'),
            ),
          ),
        ],
      ),
    );
  }

  static String _qty(double q) =>
      q == q.roundToDouble() ? q.toStringAsFixed(0) : q.toString();
}

// ---------------------------------------------------------------------------
// Option form
// ---------------------------------------------------------------------------

Future<void> _showOptionForm(
  BuildContext context,
  WidgetRef ref,
  int mealTypeId, {
  MenuOption? existing,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) =>
        _OptionFormSheet(mealTypeId: mealTypeId, existing: existing),
  );
}

class _OptionFormSheet extends ConsumerStatefulWidget {
  final int mealTypeId;
  final MenuOption? existing;

  const _OptionFormSheet({required this.mealTypeId, this.existing});

  @override
  ConsumerState<_OptionFormSheet> createState() => _OptionFormSheetState();
}

class _OptionFormSheetState extends ConsumerState<_OptionFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _orderController;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.existing?.name ?? '');
    _orderController =
        TextEditingController(text: '${widget.existing?.order ?? 0}');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _orderController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });
    final option = MenuOption(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      mealType: widget.mealTypeId,
      name: _nameController.text.trim(),
      order: int.tryParse(_orderController.text) ?? 0,
      ingredients: const [],
    );
    final service = ref.read(menuOptionsServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(option.toJson());
      } else {
        await service.update(widget.existing!.id, option.toJson());
      }
      ref.invalidate(menuOptionsProvider(widget.mealTypeId));
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
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
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.existing == null ? 'Nova opção' : 'Editar opção',
                  style: Theme.of(context).textTheme.titleMedium),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Nome da opção'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe um nome' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _orderController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Ordem'),
              ),
              if (_error != null) ...[
                SizedBox(height: AppSpacing.sm),
                Text(_error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              SizedBox(height: AppSpacing.md),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _isSaving ? null : _save,
                  child: _isSaving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Salvar'),
                ),
              ),
              SizedBox(height: AppSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Ingredient form
// ---------------------------------------------------------------------------

Future<void> _showIngredientForm(
  BuildContext context,
  WidgetRef ref,
  int optionId, {
  required int mealTypeId,
  required List<Food> foods,
  MenuOptionIngredient? existing,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _IngredientFormSheet(
      optionId: optionId,
      mealTypeId: mealTypeId,
      foods: foods,
      existing: existing,
    ),
  );
}

class _IngredientFormSheet extends ConsumerStatefulWidget {
  final int optionId;
  final int mealTypeId;
  final List<Food> foods;
  final MenuOptionIngredient? existing;

  const _IngredientFormSheet({
    required this.optionId,
    required this.mealTypeId,
    required this.foods,
    this.existing,
  });

  @override
  ConsumerState<_IngredientFormSheet> createState() =>
      _IngredientFormSheetState();
}

class _IngredientFormSheetState extends ConsumerState<_IngredientFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _quantityController;
  int? _foodId;
  String _unit = 'g';
  bool _isOptional = false;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _quantityController = TextEditingController(
      text: e == null ? '' : _IngredientFormSheetState._fmt(e.quantity),
    );
    _foodId = e?.food ?? (widget.foods.isEmpty ? null : widget.foods.first.id);
    _unit = e?.unit ?? 'g';
    _isOptional = e?.isOptional ?? false;
  }

  static String _fmt(double q) =>
      q == q.roundToDouble() ? q.toStringAsFixed(0) : q.toString();

  @override
  void dispose() {
    _quantityController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_foodId == null) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });
    final ing = MenuOptionIngredient(
      id: widget.existing?.id ?? 0,
      menuOption: widget.optionId,
      food: _foodId!,
      quantity:
          double.tryParse(_quantityController.text.replaceAll(',', '.')) ?? 0,
      unit: _unit,
      isOptional: _isOptional,
    );
    final service = ref.read(menuOptionIngredientsServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(ing.toJson());
      } else {
        await service.update(widget.existing!.id, ing.toJson());
      }
      ref.invalidate(menuOptionsProvider(widget.mealTypeId));
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
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
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                  widget.existing == null
                      ? 'Novo ingrediente'
                      : 'Editar ingrediente',
                  style: Theme.of(context).textTheme.titleMedium),
              SizedBox(height: AppSpacing.md),
              DropdownButtonFormField<int>(
                value: _foodId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Alimento'),
                items: widget.foods
                    .map((f) =>
                        DropdownMenuItem(value: f.id, child: Text(f.name)))
                    .toList(),
                onChanged: (v) => setState(() => _foodId = v),
                validator: (v) => v == null ? 'Selecione um alimento' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _quantityController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration:
                          const InputDecoration(labelText: 'Quantidade'),
                      validator: (v) => (v == null || v.isEmpty)
                          ? 'Informe a quantidade'
                          : null,
                    ),
                  ),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _unit,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Unidade'),
                      items: ChoiceLabels.measurementUnits.entries
                          .map((e) => DropdownMenuItem(
                              value: e.key, child: Text(e.value)))
                          .toList(),
                      onChanged: (v) => setState(() => _unit = v!),
                    ),
                  ),
                ],
              ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Opcional'),
                value: _isOptional,
                onChanged: (v) => setState(() => _isOptional = v ?? false),
              ),
              if (_error != null) ...[
                SizedBox(height: AppSpacing.sm),
                Text(_error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              SizedBox(height: AppSpacing.md),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _isSaving ? null : _save,
                  child: _isSaving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Salvar'),
                ),
              ),
              SizedBox(height: AppSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }
}
