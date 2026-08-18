import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/goal.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';

Future<bool?> showGoalFormSheet(BuildContext context, {Goal? existing}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _GoalFormSheet(existing: existing),
  );
}

class _GoalFormSheet extends ConsumerStatefulWidget {
  final Goal? existing;

  const _GoalFormSheet({this.existing});

  @override
  ConsumerState<_GoalFormSheet> createState() => _GoalFormSheetState();
}

class _GoalFormSheetState extends ConsumerState<_GoalFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleController;
  late final TextEditingController _targetController;
  late final TextEditingController _currentController;
  String _goalType = 'custom';
  DateTime _startDate = DateTime.now();
  DateTime? _endDate;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _titleController = TextEditingController(text: existing?.title ?? '');
    _targetController = TextEditingController(
      text: existing == null ? '' : existing.targetValue.toStringAsFixed(0),
    );
    _currentController = TextEditingController(
      text: existing == null ? '0' : existing.currentValue.toStringAsFixed(0),
    );
    _goalType = existing?.goalType ?? 'custom';
    _startDate = existing?.startDate ?? DateTime.now();
    _endDate = existing?.endDate;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _targetController.dispose();
    _currentController.dispose();
    super.dispose();
  }

  Future<void> _pickDate({required bool isStart}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (isStart ? _startDate : _endDate) ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() => isStart ? _startDate = picked : _endDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final goal = Goal(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      title: _titleController.text.trim(),
      goalType: _goalType,
      targetValue: double.tryParse(_targetController.text) ?? 0,
      currentValue: double.tryParse(_currentController.text) ?? 0,
      startDate: _startDate,
      endDate: _endDate,
      status: widget.existing?.status ?? 'active',
      progressPercentage: widget.existing?.progressPercentage ?? 0,
    );

    final service = ref.read(goalsServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(goal.toJson());
      } else {
        await service.update(widget.existing!.id, goal.toJson());
      }
      ref.invalidate(goalsProvider);
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
                isEditing ? 'Editar meta' : 'Nova meta',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _titleController,
                decoration: const InputDecoration(labelText: 'Título'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe um título' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: _goalType,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Tipo'),
                items: ChoiceLabels.goalTypes.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _goalType = v!),
              ),
              SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _currentController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Atual'),
                    ),
                  ),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: TextFormField(
                      controller: _targetController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Alvo'),
                      validator: (v) =>
                          (v == null || v.isEmpty) ? 'Informe o alvo' : null,
                    ),
                  ),
                ],
              ),
              SizedBox(height: AppSpacing.sm),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Início'),
                subtitle: Text(AppFormatters.date(_startDate)),
                trailing: const Icon(Icons.calendar_today_outlined, size: 18),
                onTap: () => _pickDate(isStart: true),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Fim (opcional)'),
                subtitle: Text(
                  _endDate == null
                      ? 'Sem data final'
                      : AppFormatters.date(_endDate!),
                ),
                trailing: const Icon(Icons.calendar_today_outlined, size: 18),
                onTap: () => _pickDate(isStart: false),
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
              SizedBox(height: AppSpacing.md),
            ],
          ),
        ),
      ),
    );
  }
}
