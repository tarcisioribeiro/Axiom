import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/member.dart';
import '../../providers/finance_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/page_header.dart';
import '../../widgets/row_actions.dart';

/// Cadastro de membros — pessoas que o usuário acompanha (contrapartes de
/// empréstimo, dependentes). Foto de perfil é só exibida (upload segue no
/// web, que tem picker nativo).
class MembersScreen extends ConsumerWidget {
  const MembersScreen({super.key});

  Future<void> _delete(BuildContext context, WidgetRef ref, Member m) async {
    try {
      await ref.read(membersServiceProvider).delete(m.id);
      ref.invalidate(membersProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(membersProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showForm(context),
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(membersProvider);
            await ref.read(membersProvider.future);
          },
          child: async.when(
            loading: () => const LoadingState(variant: LoadingVariant.list),
            error: (e, _) => Center(child: Text('Erro: $e')),
            data: (members) => ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                AppPageHeader(
                  title: 'Membros',
                  icon: Icons.groups_outlined,
                  color: context.semanticColors.info,
                ),
                SizedBox(height: AppSpacing.md),
                if (members.isEmpty)
                  const EmptyState(
                    icon: Icons.groups_outlined,
                    title: 'Nenhum membro cadastrado',
                  )
                else
                  ...members.map(
                    (m) => AppCard(
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      padding: const EdgeInsets.all(AppSpacing.smd),
                      child: Row(
                        children: [
                          CircleAvatar(
                            backgroundColor: Theme.of(context)
                                .colorScheme
                                .primary
                                .withValues(alpha: 0.12),
                            child: Text(
                              m.name.isNotEmpty ? m.name[0].toUpperCase() : '?',
                              style: TextStyle(
                                  color: Theme.of(context).colorScheme.primary),
                            ),
                          ),
                          SizedBox(width: AppSpacing.smd),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(m.name,
                                    style:
                                        Theme.of(context).textTheme.titleSmall),
                                Text(
                                  [
                                    if (m.phone?.isNotEmpty ?? false) m.phone!,
                                    if (m.occupation?.isNotEmpty ?? false)
                                      m.occupation!,
                                    if (!m.active) 'inativo',
                                  ].join(' · '),
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurfaceVariant,
                                      ),
                                ),
                              ],
                            ),
                          ),
                          RowActionsMenu(
                            onEdit: () => _showForm(context, existing: m),
                            onDelete: () => _delete(context, ref, m),
                            deleteConfirmTitle: 'Excluir membro',
                            deleteConfirmMessage:
                                'Excluir "${m.name}"? Não é possível se houver '
                                'empréstimos vinculados.',
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

Future<void> _showForm(BuildContext context, {Member? existing}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _MemberFormSheet(existing: existing),
  );
}

class _MemberFormSheet extends ConsumerStatefulWidget {
  final Member? existing;

  const _MemberFormSheet({this.existing});

  @override
  ConsumerState<_MemberFormSheet> createState() => _MemberFormSheetState();
}

class _MemberFormSheetState extends ConsumerState<_MemberFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _document;
  late final TextEditingController _phone;
  late final TextEditingController _email;
  late final TextEditingController _address;
  late final TextEditingController _occupation;
  late final TextEditingController _income;
  late final TextEditingController _emergency;
  late final TextEditingController _notes;
  String _sex = 'M';
  DateTime? _birthDate;
  bool _isCreditor = false;
  bool _isBenefited = true;
  bool _active = true;
  bool _isSaving = false;
  String? _error;

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _name = TextEditingController(text: e?.name ?? '');
    _document = TextEditingController();
    _phone = TextEditingController(text: e?.phone ?? '');
    _email = TextEditingController(text: e?.email ?? '');
    _address = TextEditingController(text: e?.address ?? '');
    _occupation = TextEditingController(text: e?.occupation ?? '');
    _income = TextEditingController(
        text: e?.monthlyIncome == null
            ? ''
            : e!.monthlyIncome!.toStringAsFixed(2));
    _emergency = TextEditingController(text: e?.emergencyContact ?? '');
    _notes = TextEditingController(text: e?.notes ?? '');
    _sex = e?.sex ?? 'M';
    _birthDate = e?.birthDate;
    _isCreditor = e?.isCreditor ?? false;
    _isBenefited = e?.isBenefited ?? true;
    _active = e?.active ?? true;
  }

  @override
  void dispose() {
    for (final c in [
      _name,
      _document,
      _phone,
      _email,
      _address,
      _occupation,
      _income,
      _emergency,
      _notes,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickBirthDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(2000),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _birthDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_isEditing && _document.text.trim().isEmpty) {
      setState(() => _error = 'CPF é obrigatório para novos membros.');
      return;
    }
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final member = Member(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      name: _name.text.trim(),
      phone: _phone.text.trim(),
      email: _email.text.trim(),
      sex: _sex,
      birthDate: _birthDate,
      address: _address.text.trim(),
      occupation: _occupation.text.trim(),
      monthlyIncome: double.tryParse(_income.text.replaceAll(',', '.')),
      emergencyContact: _emergency.text.trim(),
      notes: _notes.text.trim(),
      isCreditor: _isCreditor,
      isBenefited: _isBenefited,
      active: _active,
    );

    final service = ref.read(membersServiceProvider);
    try {
      final payload = member.toJson(document: _document.text.trim());
      if (_isEditing) {
        // PATCH so the write-only `document` (CPF) isn't required on edit.
        payload.remove('document');
        await service.patch(widget.existing!.id, payload);
      } else {
        await service.create(payload);
      }
      ref.invalidate(membersProvider);
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
              Text(_isEditing ? 'Editar membro' : 'Novo membro',
                  style: Theme.of(context).textTheme.titleMedium),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Nome'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe o nome' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              if (!_isEditing)
                TextFormField(
                  controller: _document,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'CPF'),
                )
              else
                Text(
                  'O CPF não é exibido nem editável aqui.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
              SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(labelText: 'Telefone'),
                      validator: (v) => (v == null || v.isEmpty)
                          ? 'Informe o telefone'
                          : null,
                    ),
                  ),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _sex,
                      decoration: const InputDecoration(labelText: 'Sexo'),
                      items: ChoiceLabels.memberSex.entries
                          .map((e) => DropdownMenuItem(
                              value: e.key, child: Text(e.value)))
                          .toList(),
                      onChanged: (v) => setState(() => _sex = v!),
                    ),
                  ),
                ],
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration:
                    const InputDecoration(labelText: 'E-mail (opcional)'),
              ),
              SizedBox(height: AppSpacing.sm),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Nascimento (opcional)'),
                subtitle: Text(
                    _birthDate == null ? '—' : AppFormatters.date(_birthDate!)),
                trailing: _birthDate == null
                    ? const Icon(Icons.calendar_today_outlined, size: 18)
                    : IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () => setState(() => _birthDate = null),
                      ),
                onTap: _pickBirthDate,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _occupation,
                decoration:
                    const InputDecoration(labelText: 'Profissão (opcional)'),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _income,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration:
                    const InputDecoration(labelText: 'Renda mensal (opcional)'),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _address,
                decoration:
                    const InputDecoration(labelText: 'Endereço (opcional)'),
                maxLines: 2,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _emergency,
                decoration: const InputDecoration(
                    labelText: 'Contato de emergência (opcional)'),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _notes,
                decoration:
                    const InputDecoration(labelText: 'Observações (opcional)'),
                maxLines: 2,
              ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Pode ser devedor (empréstimos)'),
                value: _isBenefited,
                onChanged: (v) => setState(() => _isBenefited = v ?? false),
              ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Pode ser credor (empréstimos)'),
                value: _isCreditor,
                onChanged: (v) => setState(() => _isCreditor = v ?? false),
              ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Ativo'),
                value: _active,
                onChanged: (v) => setState(() => _active = v ?? true),
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
