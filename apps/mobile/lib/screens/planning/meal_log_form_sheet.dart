import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/meal_log.dart';
import '../../models/meal_type.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';

Future<bool?> showMealLogFormSheet(
  BuildContext context, {
  required List<MealType> mealTypes,
  required DateTime date,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _MealLogFormSheet(mealTypes: mealTypes, date: date),
  );
}

class _MealLogFormSheet extends ConsumerStatefulWidget {
  final List<MealType> mealTypes;
  final DateTime date;

  const _MealLogFormSheet({required this.mealTypes, required this.date});

  @override
  ConsumerState<_MealLogFormSheet> createState() => _MealLogFormSheetState();
}

class _MealLogFormSheetState extends ConsumerState<_MealLogFormSheet> {
  final _notesController = TextEditingController();
  int? _mealTypeId;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _mealTypeId = widget.mealTypes.isEmpty ? null : widget.mealTypes.first.id;
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_mealTypeId == null) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final log = MealLog(
      id: 0,
      uuid: '',
      mealType: _mealTypeId!,
      isFreeMeal: true,
      date: widget.date,
      notes: _notesController.text.trim().isEmpty
          ? null
          : _notesController.text.trim(),
    );

    try {
      await ref.read(mealLogsServiceProvider).create(log.toJson());
      ref.invalidate(mealLogsProvider);
      ref.invalidate(dailyCaloricSummaryProvider(widget.date));
      if (mounted) Navigator.of(context).pop(true);
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Registrar refeição',
                style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: AppSpacing.md),
            if (widget.mealTypes.isEmpty)
              const Text('Cadastre um tipo de refeição primeiro.')
            else
              DropdownButtonFormField<int>(
                value: _mealTypeId,
                isExpanded: true,
                decoration:
                    const InputDecoration(labelText: 'Tipo de refeição'),
                items: widget.mealTypes
                    .map((m) =>
                        DropdownMenuItem(value: m.id, child: Text(m.name)))
                    .toList(),
                onChanged: (v) => setState(() => _mealTypeId = v),
              ),
            SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _notesController,
              decoration: const InputDecoration(labelText: 'Notas (opcional)'),
              maxLines: 2,
            ),
            if (_error != null) ...[
              SizedBox(height: AppSpacing.sm),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: (_isSaving || _mealTypeId == null) ? null : _save,
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
    );
  }
}
