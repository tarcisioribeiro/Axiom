import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../models/credit_card.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';

Future<bool?> showCreditCardFormSheet(
  BuildContext context, {
  CreditCard? existing,
  required List<Account> accounts,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) =>
        _CreditCardFormSheet(existing: existing, accounts: accounts),
  );
}

class _CreditCardFormSheet extends ConsumerStatefulWidget {
  final CreditCard? existing;
  final List<Account> accounts;

  const _CreditCardFormSheet({this.existing, required this.accounts});

  @override
  ConsumerState<_CreditCardFormSheet> createState() =>
      _CreditCardFormSheetState();
}

class _CreditCardFormSheetState extends ConsumerState<_CreditCardFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _onCardNameController;
  late final TextEditingController _numberController;
  late final TextEditingController _securityCodeController;
  late final TextEditingController _limitController;
  late final TextEditingController _closingDayController;
  late final TextEditingController _dueDayController;
  String _flag = 'VSA';
  int? _accountId;
  DateTime _validationDate = DateTime.now().add(const Duration(days: 365 * 4));
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _nameController = TextEditingController(text: existing?.name ?? '');
    _onCardNameController =
        TextEditingController(text: existing?.onCardName ?? '');
    _numberController = TextEditingController();
    _securityCodeController = TextEditingController();
    _limitController = TextEditingController(
      text: existing == null ? '' : existing.creditLimit.toStringAsFixed(2),
    );
    _closingDayController = TextEditingController(
      text: '${existing?.closingDay ?? 1}',
    );
    _dueDayController =
        TextEditingController(text: '${existing?.dueDay ?? 10}');
    _flag = existing?.flag ?? 'VSA';
    _accountId = existing?.associatedAccount ??
        (widget.accounts.isEmpty ? null : widget.accounts.first.id);
    _validationDate = existing?.validationDate ?? _validationDate;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _onCardNameController.dispose();
    _numberController.dispose();
    _securityCodeController.dispose();
    _limitController.dispose();
    _closingDayController.dispose();
    _dueDayController.dispose();
    super.dispose();
  }

  Future<void> _pickValidationDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _validationDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _validationDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() || _accountId == null) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final limit =
        double.tryParse(_limitController.text.replaceAll(',', '.')) ?? 0;
    final card = CreditCard(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      name: _nameController.text.trim(),
      onCardName: _onCardNameController.text.trim(),
      flag: _flag,
      validationDate: _validationDate,
      creditLimit: limit,
      maxLimit: limit,
      associatedAccount: _accountId!,
      usedCredit: widget.existing?.usedCredit ?? 0,
      availableCredit: widget.existing?.availableCredit ?? limit,
      isActive: true,
      closingDay: int.tryParse(_closingDayController.text) ?? 1,
      dueDay: int.tryParse(_dueDayController.text) ?? 10,
    );

    final service = ref.read(creditCardsServiceProvider);
    try {
      final payload = card.toJson(
        cardNumber: _numberController.text.trim().isEmpty
            ? null
            : _numberController.text.trim(),
        securityCode: _securityCodeController.text.trim().isEmpty
            ? null
            : _securityCodeController.text.trim(),
      );
      if (widget.existing == null) {
        await service.create(payload);
      } else {
        await service.update(widget.existing!.id, payload);
      }
      ref.invalidate(creditCardsProvider);
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
                isEditing ? 'Editar cartão' : 'Novo cartão',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _nameController,
                decoration:
                    const InputDecoration(labelText: 'Apelido do cartão'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe um nome' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _onCardNameController,
                decoration:
                    const InputDecoration(labelText: 'Nome impresso no cartão'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe o nome impresso' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: _flag,
                decoration: const InputDecoration(labelText: 'Bandeira'),
                items: ChoiceLabels.cardFlags.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _flag = v!),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _numberController,
                decoration: InputDecoration(
                  labelText: isEditing
                      ? 'Número do cartão (deixe em branco para manter)'
                      : 'Número do cartão',
                ),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _securityCodeController,
                decoration: InputDecoration(
                  labelText:
                      isEditing ? 'CVV (deixe em branco para manter)' : 'CVV',
                ),
                keyboardType: TextInputType.number,
              ),
              SizedBox(height: AppSpacing.sm),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Validade'),
                subtitle: Text(AppFormatters.date(_validationDate)),
                trailing: const Icon(Icons.calendar_today_outlined, size: 18),
                onTap: _pickValidationDate,
              ),
              TextFormField(
                controller: _limitController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Limite'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe o limite' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _closingDayController,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Dia de fechamento'),
                    ),
                  ),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: TextFormField(
                      controller: _dueDayController,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Dia de vencimento'),
                    ),
                  ),
                ],
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<int>(
                value: _accountId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Conta associada'),
                items: widget.accounts
                    .map((a) => DropdownMenuItem(
                        value: a.id, child: Text(a.accountName)))
                    .toList(),
                onChanged: (v) => setState(() => _accountId = v),
                validator: (v) => v == null ? 'Selecione uma conta' : null,
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
