import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/routine_task.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';
import '../../widgets/feedback.dart';
import '../../widgets/form_sheet_submit_footer.dart';

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
  bool _isOptional = false;
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
    _isOptional = existing?.isOptional ?? false;
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
      isOptional: _isOptional,
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
      if (mounted) {
        showAppToast(context, 'Salvo com sucesso.');
        Navigator.of(context).pop(true);
      }
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
                initialValue: _category,
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
                initialValue: _priority,
                decoration: const InputDecoration(labelText: 'Prioridade'),
                items: ChoiceLabels.taskPriorities.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _priority = v!),
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                initialValue: _periodicity,
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
                  initialValue: _weekday,
                  decoration: const InputDecoration(labelText: 'Dia da semana'),
                  items: ChoiceLabels.weekdays.entries
                      .map((e) =>
                          DropdownMenuItem(value: e.key, child: Text(e.value)))
                      .toList(),
                  onChanged: (v) => setState(() => _weekday = v!),
                ),
              ],
              SizedBox(height: AppSpacing.sm),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Tarefa opcional'),
                subtitle: const Text(
                  'Não impede o dia de ser concluído nem quebra o streak',
                ),
                value: _isOptional,
                onChanged: (v) => setState(() => _isOptional = v),
              ),
              FormSheetSubmitFooter(
                error: _error,
                isSaving: _isSaving,
                onSubmit: _save,
              ),
              SizedBox(height: AppSpacing.md),
            ],
          ),
        ),
      ),
    );
  }
}
