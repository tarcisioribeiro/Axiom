import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../models/loan.dart';
import '../../models/member.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';

Future<bool?> showLoanFormSheet(
  BuildContext context, {
  Loan? existing,
  required List<Account> accounts,
  required List<Member> members,
  required Member? currentMember,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _LoanFormSheet(
      existing: existing,
      accounts: accounts,
      members: members,
      currentMember: currentMember,
    ),
  );
}

class _LoanFormSheet extends ConsumerStatefulWidget {
  final Loan? existing;
  final List<Account> accounts;
  final List<Member> members;
  final Member? currentMember;

  const _LoanFormSheet({
    this.existing,
    required this.accounts,
    required this.members,
    required this.currentMember,
  });

  @override
  ConsumerState<_LoanFormSheet> createState() => _LoanFormSheetState();
}

class _LoanFormSheetState extends ConsumerState<_LoanFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _descriptionController;
  late final TextEditingController _valueController;
  late final TextEditingController _installmentsController;
  late final TextEditingController _notesController;
  String _loanType = 'lent';
  String _frequency = 'monthly';
  int? _accountId;
  int? _counterpartyId;
  DateTime _date = DateTime.now();
  DateTime? _dueDate;
  bool _isSaving = false;
  String? _error;

  /// Members eligible as the "other party" — everyone except the user's own
  /// member record (the user is always the implicit other side).
  List<Member> get _counterparties =>
      widget.members.where((m) => m.id != widget.currentMember?.id).toList();

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _descriptionController = TextEditingController(text: e?.description ?? '');
    _valueController = TextEditingController(
      text: e == null ? '' : e.value.toStringAsFixed(2),
    );
    _installmentsController =
        TextEditingController(text: '${e?.installments ?? 1}');
    _notesController = TextEditingController(text: e?.notes ?? '');
    _loanType = e?.loanType ?? 'lent';
    _frequency = e?.paymentFrequency ?? 'monthly';
    _accountId = e?.account ??
        (widget.accounts.isEmpty ? null : widget.accounts.first.id);
    _date = e?.date ?? DateTime.now();
    _dueDate = e?.dueDate;
    if (e != null) {
      _counterpartyId = e.loanType == 'lent' ? e.benefited : e.creditor;
    } else if (_counterparties.isNotEmpty) {
      _counterpartyId = _counterparties.first.id;
    }
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _valueController.dispose();
    _installmentsController.dispose();
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

  Future<void> _createMember() async {
    final created = await showDialog<Member>(
      context: context,
      builder: (_) => const _QuickMemberDialog(),
    );
    if (created != null) {
      ref.invalidate(membersProvider);
      setState(() => _counterpartyId = created.id);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final me = widget.currentMember;
    if (me == null) {
      setState(() => _error =
          'Você ainda não tem um cadastro de membro. Crie-o no app web.');
      return;
    }
    if (_counterpartyId == null || _accountId == null) return;

    setState(() {
      _isSaving = true;
      _error = null;
    });

    final isLent = _loanType == 'lent';
    final loan = Loan(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      description: _descriptionController.text.trim(),
      value: double.tryParse(_valueController.text.replaceAll(',', '.')) ?? 0,
      payedValue: widget.existing?.payedValue ?? 0,
      remainingBalance: widget.existing?.remainingBalance ?? 0,
      date: _date,
      dueDate: _dueDate,
      category: widget.existing?.category ?? 'loans',
      account: _accountId!,
      benefited: isLent ? _counterpartyId! : me.id,
      creditor: isLent ? me.id : _counterpartyId!,
      installments: int.tryParse(_installmentsController.text) ?? 1,
      status: widget.existing?.status ?? 'active',
      loanType: _loanType,
      paymentFrequency: _frequency,
      payed: widget.existing?.payed ?? false,
      notes: _notesController.text.trim(),
    );

    final service = ref.read(loansServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(loan.toJson());
      } else {
        await service.update(widget.existing!.id, loan.toJson());
      }
      ref.invalidate(loansProvider);
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
    final counterpartyLabel =
        _loanType == 'lent' ? 'Para quem emprestei' : 'De quem tomei';

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          bottom: AppSpacing.md + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isEditing ? 'Editar empréstimo' : 'Novo empréstimo',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                SizedBox(height: AppSpacing.md),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'lent', label: Text('Concedi')),
                    ButtonSegment(value: 'borrowed', label: Text('Tomei')),
                  ],
                  selected: {_loanType},
                  onSelectionChanged: (s) =>
                      setState(() => _loanType = s.first),
                ),
                SizedBox(height: AppSpacing.sm),
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
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        value: _counterpartyId,
                        isExpanded: true,
                        decoration:
                            InputDecoration(labelText: counterpartyLabel),
                        items: _counterparties
                            .map((m) => DropdownMenuItem(
                                value: m.id, child: Text(m.name)))
                            .toList(),
                        onChanged: (v) => setState(() => _counterpartyId = v),
                        validator: (v) =>
                            v == null ? 'Selecione um membro' : null,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Novo membro',
                      icon: const Icon(Icons.person_add_alt_1_outlined),
                      onPressed: _createMember,
                    ),
                  ],
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
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _installmentsController,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Parcelas'),
                      ),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: _frequency,
                        isExpanded: true,
                        decoration:
                            const InputDecoration(labelText: 'Frequência'),
                        items: ChoiceLabels.paymentFrequencies.entries
                            .map((e) => DropdownMenuItem(
                                value: e.key, child: Text(e.value)))
                            .toList(),
                        onChanged: (v) => setState(() => _frequency = v!),
                      ),
                    ),
                  ],
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Data'),
                  subtitle: Text(AppFormatters.date(_date)),
                  trailing: const Icon(Icons.calendar_today_outlined, size: 18),
                  onTap: () => _pickDate(isDue: false),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('1º vencimento (opcional)'),
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
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.error)),
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
      ),
    );
  }
}

/// Minimal member creation for the loan flow — name + CPF, plus the two
/// role flags. Full member management lives on the web app.
class _QuickMemberDialog extends ConsumerStatefulWidget {
  const _QuickMemberDialog();

  @override
  ConsumerState<_QuickMemberDialog> createState() => _QuickMemberDialogState();
}

class _QuickMemberDialogState extends ConsumerState<_QuickMemberDialog> {
  final _nameController = TextEditingController();
  final _documentController = TextEditingController();
  final _phoneController = TextEditingController();
  String _sex = 'M';
  bool _isBenefited = true;
  bool _isCreditor = true;
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _documentController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    final document = _documentController.text.trim();
    final phone = _phoneController.text.trim();
    if (name.isEmpty || document.isEmpty || phone.isEmpty) {
      setState(() => _error = 'Nome, CPF e telefone são obrigatórios.');
      return;
    }
    setState(() {
      _isSaving = true;
      _error = null;
    });
    try {
      final member = await ref.read(membersServiceProvider).quickCreate(
            name: name,
            document: document,
            phone: phone,
            sex: _sex,
            isBenefited: _isBenefited,
            isCreditor: _isCreditor,
          );
      if (mounted) Navigator.of(context).pop(member);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Novo membro'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Nome'),
            ),
            SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _documentController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'CPF'),
            ),
            SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Telefone'),
            ),
            SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              value: _sex,
              decoration: const InputDecoration(labelText: 'Sexo'),
              items: const [
                DropdownMenuItem(value: 'M', child: Text('Masculino')),
                DropdownMenuItem(value: 'F', child: Text('Feminino')),
              ],
              onChanged: (v) => setState(() => _sex = v!),
            ),
            SizedBox(height: AppSpacing.sm),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Pode ser devedor'),
              value: _isBenefited,
              onChanged: (v) => setState(() => _isBenefited = v ?? false),
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Pode ser credor'),
              value: _isCreditor,
              onChanged: (v) => setState(() => _isCreditor = v ?? false),
            ),
            if (_error != null)
              Text(_error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSaving ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: _isSaving ? null : _save,
          child: const Text('Criar'),
        ),
      ],
    );
  }
}
