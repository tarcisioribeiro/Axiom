import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/meal_type.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';

Future<bool?> showMealTypeFormSheet(BuildContext context,
    {MealType? existing}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _MealTypeFormSheet(existing: existing),
  );
}

class _MealTypeFormSheet extends ConsumerStatefulWidget {
  final MealType? existing;

  const _MealTypeFormSheet({this.existing});

  @override
  ConsumerState<_MealTypeFormSheet> createState() => _MealTypeFormSheetState();
}

class _MealTypeFormSheetState extends ConsumerState<_MealTypeFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  TimeOfDay? _suggestedTime;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.existing?.name ?? '');
    final time = widget.existing?.suggestedTime;
    if (time != null && time.contains(':')) {
      final parts = time.split(':');
      _suggestedTime = TimeOfDay(
        hour: int.tryParse(parts[0]) ?? 12,
        minute: int.tryParse(parts[1]) ?? 0,
      );
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _suggestedTime ?? TimeOfDay.now(),
    );
    if (picked != null) setState(() => _suggestedTime = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final mealType = MealType(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      name: _nameController.text.trim(),
      suggestedTime: _suggestedTime == null
          ? null
          : '${_suggestedTime!.hour.toString().padLeft(2, '0')}:'
              '${_suggestedTime!.minute.toString().padLeft(2, '0')}:00',
      order: widget.existing?.order ?? 0,
      isActive: widget.existing?.isActive ?? true,
    );

    final service = ref.read(mealTypesServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(mealType.toJson());
      } else {
        await service.update(widget.existing!.id, mealType.toJson());
      }
      ref.invalidate(mealTypesProvider);
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
                isEditing ? 'Editar tipo de refeição' : 'Novo tipo de refeição',
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
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Horário sugerido'),
                subtitle:
                    Text(_suggestedTime?.format(context) ?? 'Sem horário'),
                trailing: const Icon(Icons.access_time_outlined, size: 18),
                onTap: _pickTime,
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
