import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/routine_task.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';

Future<bool?> showRoutineTaskFormSheet(
  BuildContext context, {
  RoutineTask? existing,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _RoutineTaskFormSheet(existing: existing),
  );
}

class _RoutineTaskFormSheet extends ConsumerStatefulWidget {
  final RoutineTask? existing;

  const _RoutineTaskFormSheet({this.existing});

  @override
  ConsumerState<_RoutineTaskFormSheet> createState() =>
      _RoutineTaskFormSheetState();
}

class _RoutineTaskFormSheetState extends ConsumerState<_RoutineTaskFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  String _category = 'other';
  String _priority = 'medium';
  String _periodicity = 'daily';
  int _weekday = 0;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _nameController = TextEditingController(text: existing?.name ?? '');
    _category = existing?.category ?? 'other';
    _priority = existing?.priority ?? 'medium';
    _periodicity = existing?.periodicity ?? 'daily';
    _weekday = existing?.weekday ?? 0;
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final task = RoutineTask(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      name: _nameController.text.trim(),
      category: _category,
      periodicity: _periodicity,
      weekday: _periodicity == 'weekly' ? _weekday : null,
      priority: _priority,
      isActive: widget.existing?.isActive ?? true,
      completionRate: widget.existing?.completionRate ?? 0,
    );

    final service = ref.read(routineTasksServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(task.toJson());
      } else {
        await service.update(widget.existing!.id, task.toJson());
      }
      ref.invalidate(routineTasksProvider);
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
                isEditing ? 'Editar rotina' : 'Nova rotina',
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
              DropdownButtonFormField<String>(
                value: _category,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Categoria'),
                items: ChoiceLabels.taskCategories.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _category = v!),
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: _priority,
                decoration: const InputDecoration(labelText: 'Prioridade'),
                items: ChoiceLabels.taskPriorities.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _priority = v!),
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: _periodicity,
                decoration: const InputDecoration(labelText: 'Periodicidade'),
                items: ChoiceLabels.periodicities.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _periodicity = v!),
              ),
              if (_periodicity == 'weekly') ...[
                SizedBox(height: AppSpacing.sm),
                DropdownButtonFormField<int>(
                  value: _weekday,
                  decoration: const InputDecoration(labelText: 'Dia da semana'),
                  items: ChoiceLabels.weekdays.entries
                      .map((e) =>
                          DropdownMenuItem(value: e.key, child: Text(e.value)))
                      .toList(),
                  onChanged: (v) => setState(() => _weekday = v!),
                ),
              ],
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
              SizedBox(height: AppSpacing.md),
            ],
          ),
        ),
      ),
    );
  }
}
