import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/stored_account.dart';
import '../../providers/security_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';
import '../../widgets/app_card.dart';
import '../../widgets/confirm.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';

const _autoHideSeconds = 30;

/// "Contas" tab of the unlocked vault — bank-account credentials.
class StoredAccountList extends ConsumerStatefulWidget {
  const StoredAccountList({super.key});

  @override
  ConsumerState<StoredAccountList> createState() => _StoredAccountListState();
}

class _StoredAccountListState extends ConsumerState<StoredAccountList> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final accountsAsync = ref.watch(storedAccountsProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAccountForm(context),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(storedAccountsProvider);
          await ref.read(storedAccountsProvider.future);
        },
        child: accountsAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (e, _) => Center(child: Text('Erro: $e')),
          data: (all) {
            final query = _searchController.text.trim().toLowerCase();
            final accounts = all
                .where((a) =>
                    query.isEmpty ||
                    a.name.toLowerCase().contains(query) ||
                    a.institutionName.toLowerCase().contains(query))
                .toList();

            return ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    isDense: true,
                    hintText: 'Buscar contas...',
                    prefixIcon: Icon(Icons.search_rounded, size: 20),
                  ),
                ),
                SizedBox(height: AppSpacing.sm),
                if (accounts.isEmpty)
                  const EmptyState(
                    icon: Icons.account_balance_outlined,
                    title: 'Nenhuma conta guardada',
                  )
                else
                  ...accounts.map(
                    (account) => AppCard(
                      onTap: () => _showAccountDetail(context, account),
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      padding: const EdgeInsets.all(AppSpacing.smd),
                      child: Row(
                        children: [
                          const Icon(Icons.account_balance_rounded),
                          SizedBox(width: AppSpacing.smd),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(account.name,
                                    style:
                                        Theme.of(context).textTheme.titleSmall),
                                Text(
                                  '${account.institutionName} · '
                                  '${ChoiceLabels.of(ChoiceLabels.storedAccountTypes, account.accountType)}'
                                  ' · ${account.accountNumberMasked ?? '••••'}',
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
                          if (account.isFavorite)
                            const Icon(Icons.star_rounded,
                                color: Colors.amber, size: 18),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

void _showAccountDetail(BuildContext context, StoredAccount account) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _AccountDetailSheet(account: account),
  );
}

class _AccountDetailSheet extends ConsumerStatefulWidget {
  final StoredAccount account;

  const _AccountDetailSheet({required this.account});

  @override
  ConsumerState<_AccountDetailSheet> createState() =>
      _AccountDetailSheetState();
}

class _AccountDetailSheetState extends ConsumerState<_AccountDetailSheet> {
  StoredAccountReveal? _revealed;
  int _secondsLeft = 0;
  Timer? _timer;
  bool _isRevealing = false;
  String? _error;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startCountdown() {
    _timer?.cancel();
    _secondsLeft = _autoHideSeconds;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() => _secondsLeft -= 1);
      if (_secondsLeft <= 0) {
        timer.cancel();
        setState(() => _revealed = null);
      }
    });
  }

  Future<void> _reveal() async {
    setState(() {
      _isRevealing = true;
      _error = null;
    });
    try {
      final r = await ref
          .read(storedAccountsServiceProvider)
          .reveal(widget.account.id);
      setState(() => _revealed = r);
      _startCountdown();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isRevealing = false);
    }
  }

  Future<void> _copyNumber() async {
    try {
      final r =
          await ref.read(storedAccountsServiceProvider).copy(widget.account.id);
      await Clipboard.setData(ClipboardData(text: r.accountNumber));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Número da conta copiado.')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _toggleFavorite() async {
    try {
      await ref
          .read(storedAccountsServiceProvider)
          .toggleFavorite(widget.account.id);
      ref.invalidate(storedAccountsProvider);
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _delete() async {
    final ok = await confirmDelete(
      context,
      title: 'Excluir conta',
      message: 'Excluir "${widget.account.name}" do cofre? '
          'Essa ação não pode ser desfeita.',
    );
    if (!ok) return;
    try {
      await ref.read(storedAccountsServiceProvider).delete(widget.account.id);
      ref.invalidate(storedAccountsProvider);
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final account = widget.account;
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          bottom: AppSpacing.md + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child:
                        Text(account.name, style: theme.textTheme.titleLarge),
                  ),
                  IconButton(
                    icon: Icon(
                      account.isFavorite
                          ? Icons.star_rounded
                          : Icons.star_outline_rounded,
                      color: account.isFavorite ? Colors.amber : null,
                    ),
                    onPressed: _toggleFavorite,
                  ),
                ],
              ),
              Text(
                '${account.institutionName} · '
                '${ChoiceLabels.of(ChoiceLabels.storedAccountTypes, account.accountType)}',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              SizedBox(height: AppSpacing.md),
              if (account.agency != null)
                _Row(label: 'Agência', value: account.agency!),
              _Row(
                label: 'Conta',
                value: account.accountNumberMasked ?? '••••',
              ),
              SizedBox(height: AppSpacing.sm),
              if (_revealed != null)
                Container(
                  padding: const EdgeInsets.all(AppSpacing.smd),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primary.withValues(alpha: 0.08),
                    borderRadius: AppRadius.mdRadius,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: SelectableText(
                              'Conta ${_revealed!.accountNumber}',
                              style: theme.textTheme.titleMedium
                                  ?.copyWith(fontFamily: 'monospace'),
                            ),
                          ),
                          Text('${_secondsLeft}s',
                              style: theme.textTheme.labelSmall),
                        ],
                      ),
                      if ((_revealed!.password ?? '').isNotEmpty)
                        SelectableText('Senha: ${_revealed!.password}',
                            style: theme.textTheme.bodyMedium
                                ?.copyWith(fontFamily: 'monospace')),
                      if ((_revealed!.digitalPassword ?? '').isNotEmpty)
                        SelectableText(
                            'Senha digital: ${_revealed!.digitalPassword}',
                            style: theme.textTheme.bodyMedium
                                ?.copyWith(fontFamily: 'monospace')),
                    ],
                  ),
                )
              else
                OutlinedButton.icon(
                  onPressed: _isRevealing ? null : _reveal,
                  icon: _isRevealing
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.visibility_outlined, size: 18),
                  label: const Text('Revelar dados'),
                ),
              if (account.notes != null) ...[
                SizedBox(height: AppSpacing.sm),
                _Row(label: 'Notas', value: account.notes!),
              ],
              if (_error != null) ...[
                SizedBox(height: AppSpacing.sm),
                Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
              ],
              SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                children: [
                  FilledButton.icon(
                    onPressed: _copyNumber,
                    icon: const Icon(Icons.copy_outlined, size: 18),
                    label: const Text('Copiar nº'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () async {
                      Navigator.of(context).pop();
                      await _showAccountForm(context, existing: account);
                    },
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: const Text('Editar'),
                  ),
                  OutlinedButton.icon(
                    onPressed: _delete,
                    icon: const Icon(Icons.delete_outline, size: 18),
                    label: const Text('Excluir'),
                  ),
                ],
              ),
              SizedBox(height: AppSpacing.md),
            ],
          ),
        ),
      ),
    );
  }
}

Future<bool?> _showAccountForm(BuildContext context,
    {StoredAccount? existing}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _AccountFormSheet(existing: existing),
  );
}

class _AccountFormSheet extends ConsumerStatefulWidget {
  final StoredAccount? existing;

  const _AccountFormSheet({this.existing});

  @override
  ConsumerState<_AccountFormSheet> createState() => _AccountFormSheetState();
}

class _AccountFormSheetState extends ConsumerState<_AccountFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _institutionController;
  late final TextEditingController _institutionCodeController;
  late final TextEditingController _agencyController;
  late final TextEditingController _numberController;
  late final TextEditingController _passwordController;
  late final TextEditingController _digitalPasswordController;
  late final TextEditingController _notesController;
  String _accountType = 'CC';
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _nameController = TextEditingController(text: e?.name ?? '');
    _institutionController =
        TextEditingController(text: e?.institutionName ?? '');
    _institutionCodeController =
        TextEditingController(text: e?.institutionCode ?? '');
    _agencyController = TextEditingController(text: e?.agency ?? '');
    _numberController = TextEditingController();
    _passwordController = TextEditingController();
    _digitalPasswordController = TextEditingController();
    _notesController = TextEditingController(text: e?.notes ?? '');
    _accountType = e?.accountType ?? 'CC';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _institutionController.dispose();
    _institutionCodeController.dispose();
    _agencyController.dispose();
    _numberController.dispose();
    _passwordController.dispose();
    _digitalPasswordController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final account = StoredAccount(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      name: _nameController.text.trim(),
      institutionName: _institutionController.text.trim(),
      institutionCode: _institutionCodeController.text.trim().isEmpty
          ? null
          : _institutionCodeController.text.trim(),
      accountType: _accountType,
      agency: _agencyController.text.trim().isEmpty
          ? null
          : _agencyController.text.trim(),
      notes: _notesController.text.trim(),
      isFavorite: widget.existing?.isFavorite ?? false,
    );

    final service = ref.read(storedAccountsServiceProvider);
    try {
      final payload = account.toJson(
        accountNumber: _numberController.text.isEmpty
            ? null
            : _numberController.text.trim(),
        password: _passwordController.text,
        digitalPassword: _digitalPasswordController.text,
      );
      if (widget.existing == null) {
        await service.create(payload);
      } else {
        await service.update(widget.existing!.id, payload);
      }
      ref.invalidate(storedAccountsProvider);
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
              Text(isEditing ? 'Editar conta' : 'Nova conta',
                  style: Theme.of(context).textTheme.titleMedium),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Nome / apelido'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe um nome' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _institutionController,
                decoration: const InputDecoration(labelText: 'Instituição'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe a instituição' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _institutionCodeController,
                      decoration: const InputDecoration(
                          labelText: 'Código do banco (opcional)'),
                    ),
                  ),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: TextFormField(
                      controller: _agencyController,
                      decoration: const InputDecoration(
                          labelText: 'Agência (opcional)'),
                    ),
                  ),
                ],
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: _accountType,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Tipo de conta'),
                items: ChoiceLabels.storedAccountTypes.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _accountType = v!),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _numberController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: isEditing
                      ? 'Número da conta (deixe em branco para manter)'
                      : 'Número da conta',
                ),
                validator: (v) => (!isEditing && (v == null || v.isEmpty))
                    ? 'Informe o número'
                    : null,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _passwordController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: isEditing
                      ? 'Senha (deixe em branco para manter)'
                      : 'Senha (opcional)',
                ),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _digitalPasswordController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: isEditing
                      ? 'Senha digital (deixe em branco para manter)'
                      : 'Senha digital (opcional)',
                ),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _notesController,
                decoration:
                    const InputDecoration(labelText: 'Notas (opcional)'),
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
              SizedBox(height: AppSpacing.md),
            ],
          ),
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;

  const _Row({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(label,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
