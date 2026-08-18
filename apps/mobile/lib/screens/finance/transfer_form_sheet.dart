import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../models/transfer.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';

Future<bool?> showTransferFormSheet(
  BuildContext context, {
  Transfer? existing,
  required List<Account> accounts,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) =>
        _TransferFormSheet(existing: existing, accounts: accounts),
  );
}

class _TransferFormSheet extends ConsumerStatefulWidget {
  final Transfer? existing;
  final List<Account> accounts;

  const _TransferFormSheet({this.existing, required this.accounts});

  @override
  ConsumerState<_TransferFormSheet> createState() => _TransferFormSheetState();
}

class _TransferFormSheetState extends ConsumerState<_TransferFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _descriptionController;
  late final TextEditingController _valueController;
  String _category = 'pix';
  int? _originAccountId;
  int? _destinyAccountId;
  DateTime _date = DateTime.now();
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _descriptionController =
        TextEditingController(text: existing?.description ?? '');
    _valueController = TextEditingController(
      text: existing == null ? '' : existing.value.toStringAsFixed(2),
    );
    _category = existing?.category ?? 'pix';
    _originAccountId = existing?.originAccount ??
        (widget.accounts.isEmpty ? null : widget.accounts.first.id);
    _destinyAccountId = existing?.destinyAccount ??
        (widget.accounts.length > 1 ? widget.accounts[1].id : null);
    _date = existing?.date ?? DateTime.now();
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _valueController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_originAccountId == null || _destinyAccountId == null) return;
    if (_originAccountId == _destinyAccountId) {
      setState(() =>
          _error = 'A conta de origem deve ser diferente da conta de destino.');
      return;
    }
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final transfer = Transfer(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      description: _descriptionController.text.trim(),
      value: double.tryParse(_valueController.text.replaceAll(',', '.')) ?? 0,
      date: _date,
      category: _category,
      originAccount: _originAccountId!,
      destinyAccount: _destinyAccountId!,
      transfered: widget.existing?.transfered ?? true,
      status: widget.existing?.status ?? 'completed',
    );

    final service = ref.read(transfersServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(transfer.toJson());
      } else {
        await service.update(widget.existing!.id, transfer.toJson());
      }
      ref.invalidate(transfersProvider);
      ref.invalidate(accountsProvider);
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
                isEditing ? 'Editar transferência' : 'Nova transferência',
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
                decoration: const InputDecoration(labelText: 'Valor'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe o valor' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: _category,
                decoration: const InputDecoration(labelText: 'Tipo'),
                items: ChoiceLabels.transferCategories.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _category = v!),
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<int>(
                value: _originAccountId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Conta de origem'),
                items: widget.accounts
                    .map((a) => DropdownMenuItem(
                        value: a.id, child: Text(a.accountName)))
                    .toList(),
                onChanged: (v) => setState(() => _originAccountId = v),
                validator: (v) => v == null ? 'Selecione uma conta' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<int>(
                value: _destinyAccountId,
                isExpanded: true,
                decoration:
                    const InputDecoration(labelText: 'Conta de destino'),
                items: widget.accounts
                    .map((a) => DropdownMenuItem(
                        value: a.id, child: Text(a.accountName)))
                    .toList(),
                onChanged: (v) => setState(() => _destinyAccountId = v),
                validator: (v) => v == null ? 'Selecione uma conta' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Data'),
                subtitle: Text(AppFormatters.date(_date)),
                trailing: const Icon(Icons.calendar_today_outlined, size: 18),
                onTap: _pickDate,
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
