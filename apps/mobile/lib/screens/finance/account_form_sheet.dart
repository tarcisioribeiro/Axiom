import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';

/// Opens the create/edit form for an [Account] as a bottom sheet. Returns
/// `true` if the account was saved, so the caller can refresh its list.
Future<bool?> showAccountFormSheet(
  BuildContext context, {
  Account? existing,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _AccountFormSheet(existing: existing),
  );
}

class _AccountFormSheet extends ConsumerStatefulWidget {
  final Account? existing;

  const _AccountFormSheet({this.existing});

  @override
  ConsumerState<_AccountFormSheet> createState() => _AccountFormSheetState();
}

class _AccountFormSheetState extends ConsumerState<_AccountFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _numberController;
  late final TextEditingController _balanceController;
  late final TextEditingController _overdraftController;
  String _accountType = 'CC';
  String _institution = 'CEF';
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _nameController = TextEditingController(text: existing?.accountName ?? '');
    _numberController = TextEditingController();
    _balanceController = TextEditingController(
      text: existing == null ? '0' : existing.balance.toStringAsFixed(2),
    );
    _overdraftController = TextEditingController(
      text: existing == null ? '0' : existing.overdraftLimit.toStringAsFixed(2),
    );
    if (existing != null) {
      _accountType = existing.accountType;
      _institution = existing.institution;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _numberController.dispose();
    _balanceController.dispose();
    _overdraftController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final account = Account(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      accountName: _nameController.text.trim(),
      accountType: _accountType,
      institution: _institution,
      balance:
          double.tryParse(_balanceController.text.replaceAll(',', '.')) ?? 0,
      minimumBalance: 0,
      overdraftLimit:
          double.tryParse(_overdraftController.text.replaceAll(',', '.')) ?? 0,
      isActive: true,
    );

    final service = ref.read(accountsServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(
          account.toJson(
            accountNumber: _numberController.text.trim().isEmpty
                ? null
                : _numberController.text.trim(),
          ),
        );
      } else {
        await service.update(
          widget.existing!.id,
          account.toJson(
            accountNumber: _numberController.text.trim().isEmpty
                ? null
                : _numberController.text.trim(),
          ),
        );
      }
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
                isEditing ? 'Editar conta' : 'Nova conta',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Nome da conta'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe um nome' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: _accountType,
                decoration: const InputDecoration(labelText: 'Tipo de conta'),
                items: ChoiceLabels.accountTypes.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _accountType = v!),
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: _institution,
                decoration: const InputDecoration(labelText: 'Instituição'),
                items: ChoiceLabels.institutions.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _institution = v!),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _numberController,
                decoration: InputDecoration(
                  labelText: isEditing
                      ? 'Número da conta (deixe em branco para manter)'
                      : 'Número da conta',
                ),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _balanceController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Saldo atual'),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _overdraftController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                    labelText: 'Limite de cheque especial'),
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
