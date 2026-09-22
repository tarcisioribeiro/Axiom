import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/food.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../theme/app_spacing.dart';
import '../../widgets/form_sheet_submit_footer.dart';

Future<bool?> showFoodFormSheet(BuildContext context, {Food? existing}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _FoodFormSheet(existing: existing),
  );
}

class _FoodFormSheet extends ConsumerStatefulWidget {
  final Food? existing;

  const _FoodFormSheet({this.existing});

  @override
  ConsumerState<_FoodFormSheet> createState() => _FoodFormSheetState();
}

class _FoodFormSheetState extends ConsumerState<_FoodFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _caloriesController;
  late final TextEditingController _servingSizeController;
  String _servingUnit = 'g';
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _nameController = TextEditingController(text: existing?.name ?? '');
    _caloriesController = TextEditingController(
      text: existing == null
          ? ''
          : existing.caloriesPerServing.toStringAsFixed(0),
    );
    _servingSizeController = TextEditingController(
      text: existing?.servingSize == null
          ? ''
          : AppFormatters.number(existing!.servingSize),
    );
    final unit = existing?.servingUnit;
    if (unit != null && unit.isNotEmpty) _servingUnit = unit;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _caloriesController.dispose();
    _servingSizeController.dispose();
    super.dispose();
  }

  /// Accepts pt-BR input (`2,5`).
  double? _parse(String v) => double.tryParse(v.trim().replaceAll(',', '.'));

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final food = Food(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      name: _nameController.text.trim(),
      caloriesPerServing: _parse(_caloriesController.text) ?? 0,
      servingSize: _parse(_servingSizeController.text)?.toString(),
      servingUnit: _servingUnit,
    );

    final service = ref.read(foodsServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(food.toJson());
      } else {
        await service.update(widget.existing!.id, food.toJson());
      }
      ref.invalidate(foodsProvider);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.existing != null;
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
                isEditing ? 'Editar alimento' : 'Novo alimento',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Nome'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe um nome' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _caloriesController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                    labelText: 'Calorias (kcal) por porção'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe as calorias' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _servingSizeController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration:
                          const InputDecoration(labelText: 'Tamanho da porção'),
                    ),
                  ),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _servingUnit,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Unidade'),
                      items: [
                        for (final u in {
                          ...ChoiceLabels.foodServingUnits,
                          _servingUnit,
                        })
                          DropdownMenuItem(
                            value: u,
                            child: Text(ChoiceLabels.of(
                                ChoiceLabels.measurementUnits, u)),
                          ),
                      ],
                      onChanged: (v) => setState(() => _servingUnit = v!),
                    ),
                  ),
                ],
              ),
              FormSheetSubmitFooter(
                error: _error,
                isSaving: _isSaving,
                onSubmit: _save,
              ),
              SizedBox(height: AppSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }
}
