import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/receivable.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';

Future<bool?> showReceivableFormSheet(
  BuildContext context, {
  Receivable? existing,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _ReceivableFormSheet(existing: existing),
  );
}

class _ReceivableFormSheet extends ConsumerStatefulWidget {
  final Receivable? existing;

  const _ReceivableFormSheet({this.existing});

  @override
  ConsumerState<_ReceivableFormSheet> createState() =>
      _ReceivableFormSheetState();
}

class _ReceivableFormSheetState extends ConsumerState<_ReceivableFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _descriptionController;
  late final TextEditingController _valueController;
  late final TextEditingController _notesController;
  String _category = 'income';
  DateTime _date = DateTime.now();
  DateTime? _dueDate;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _descriptionController = TextEditingController(text: e?.description ?? '');
    _valueController = TextEditingController(
      text: e == null ? '' : e.value.toStringAsFixed(2),
    );
    _notesController = TextEditingController(text: e?.notes ?? '');
    _category = e?.category ?? 'income';
    _date = e?.date ?? DateTime.now();
    _dueDate = e?.dueDate;
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _valueController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDate({required bool isDue}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (isDue ? _dueDate : _date) ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() => isDue ? _dueDate = picked : _date = picked);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final receivable = Receivable(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      description: _descriptionController.text.trim(),
      value: double.tryParse(_valueController.text.replaceAll(',', '.')) ?? 0,
      receivedValue: widget.existing?.receivedValue ?? 0,
      remainingValue: widget.existing?.remainingValue ?? 0,
      date: _date,
      dueDate: _dueDate,
      category: _category,
      status: widget.existing?.status ?? 'active',
      notes: _notesController.text.trim(),
    );

    final service = ref.read(receivablesServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(receivable.toJson());
      } else {
        await service.update(widget.existing!.id, receivable.toJson());
      }
      ref.invalidate(receivablesProvider);
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
                isEditing ? 'Editar conta a receber' : 'Nova conta a receber',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(labelText: 'Descrição'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe uma descrição' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _valueController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Valor total'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe o valor' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: _category,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Categoria'),
                items: ChoiceLabels.revenueCategories.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _category = v!),
              ),
              SizedBox(height: AppSpacing.sm),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Data de registro'),
                subtitle: Text(AppFormatters.date(_date)),
                trailing: const Icon(Icons.calendar_today_outlined, size: 18),
                onTap: () => _pickDate(isDue: false),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Vencimento (opcional)'),
                subtitle: Text(
                  _dueDate == null ? '—' : AppFormatters.date(_dueDate!),
                ),
                trailing: _dueDate == null
                    ? const Icon(Icons.calendar_today_outlined, size: 18)
                    : IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () => setState(() => _dueDate = null),
                      ),
                onTap: () => _pickDate(isDue: true),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _notesController,
                decoration: const InputDecoration(
                  labelText: 'Observações (opcional)',
                ),
                maxLines: 2,
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
