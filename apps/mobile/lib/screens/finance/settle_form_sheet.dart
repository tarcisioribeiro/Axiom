import 'package:flutter/material.dart';

import '../../models/account.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../utils/formatters.dart';

/// Shared bottom sheet for "record a payment" (payables) and "record a
/// receipt" (receivables) — both take the same `{value, account, date,
/// notes}` payload server-side. [onConfirm] does the actual API call so the
/// sheet stays generic.
Future<bool?> showSettleFormSheet(
  BuildContext context, {
  required String title,
  required String actionLabel,
  required double suggestedValue,
  required List<Account> accounts,
  required Future<void> Function({
    required double value,
    required int accountId,
    required DateTime date,
    String? notes,
  }) onConfirm,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _SettleFormSheet(
      title: title,
      actionLabel: actionLabel,
      suggestedValue: suggestedValue,
      accounts: accounts,
      onConfirm: onConfirm,
    ),
  );
}

class _SettleFormSheet extends StatefulWidget {
  final String title;
  final String actionLabel;
  final double suggestedValue;
  final List<Account> accounts;
  final Future<void> Function({
    required double value,
    required int accountId,
    required DateTime date,
    String? notes,
  }) onConfirm;

  const _SettleFormSheet({
    required this.title,
    required this.actionLabel,
    required this.suggestedValue,
    required this.accounts,
    required this.onConfirm,
  });

  @override
  State<_SettleFormSheet> createState() => _SettleFormSheetState();
}

class _SettleFormSheetState extends State<_SettleFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _valueController;
  final _notesController = TextEditingController();
  int? _accountId;
  DateTime _date = DateTime.now();
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _valueController = TextEditingController(
      text: widget.suggestedValue <= 0
          ? ''
          : widget.suggestedValue.toStringAsFixed(2),
    );
    _accountId = widget.accounts.isEmpty ? null : widget.accounts.first.id;
  }

  @override
  void dispose() {
    _valueController.dispose();
    _notesController.dispose();
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
    if (_accountId == null) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });
    try {
      await widget.onConfirm(
        value: double.tryParse(_valueController.text.replaceAll(',', '.')) ?? 0,
        accountId: _accountId!,
        date: _date,
        notes: _notesController.text.trim(),
      );
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
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.title,
                  style: Theme.of(context).textTheme.titleMedium),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _valueController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Valor'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe o valor' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<int>(
                value: _accountId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Conta'),
                items: widget.accounts
                    .map((a) => DropdownMenuItem(
                        value: a.id, child: Text(a.accountName)))
                    .toList(),
                onChanged: (v) => setState(() => _accountId = v),
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
                      : Text(widget.actionLabel),
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
