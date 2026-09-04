import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/stored_card.dart';
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

/// "Cartões" tab of the unlocked vault — mirrors `_PasswordsList` for
/// [StoredCard]s (reveal with 30s auto-hide, copy, favourite, CRUD).
class StoredCardList extends ConsumerStatefulWidget {
  const StoredCardList({super.key});

  @override
  ConsumerState<StoredCardList> createState() => _StoredCardListState();
}

class _StoredCardListState extends ConsumerState<StoredCardList> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cardsAsync = ref.watch(storedCardsProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCardForm(context),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(storedCardsProvider);
          await ref.read(storedCardsProvider.future);
        },
        child: cardsAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (e, _) => Center(child: Text('Erro: $e')),
          data: (all) {
            final query = _searchController.text.trim().toLowerCase();
            final cards = all
                .where((c) =>
                    query.isEmpty ||
                    c.name.toLowerCase().contains(query) ||
                    (c.cardholderName?.toLowerCase().contains(query) ?? false))
                .toList();

            return ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    isDense: true,
                    hintText: 'Buscar cartões...',
                    prefixIcon: Icon(Icons.search_rounded, size: 20),
                  ),
                ),
                SizedBox(height: AppSpacing.sm),
                if (cards.isEmpty)
                  const EmptyState(
                    icon: Icons.credit_card_outlined,
                    title: 'Nenhum cartão guardado',
                  )
                else
                  ...cards.map(
                    (card) => AppCard(
                      onTap: () => _showCardDetail(context, card),
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      padding: const EdgeInsets.all(AppSpacing.smd),
                      child: Row(
                        children: [
                          const Icon(Icons.credit_card_rounded),
                          SizedBox(width: AppSpacing.smd),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(card.name,
                                    style:
                                        Theme.of(context).textTheme.titleSmall),
                                Text(
                                  '${ChoiceLabels.of(ChoiceLabels.storedCardFlags, card.flag)}'
                                  ' · ${card.cardNumberMasked ?? '••••'} · ${card.expiry}',
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
                          if (card.isFavorite)
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

// ---------------------------------------------------------------------------
// Detail sheet (reveal / copy / favourite / edit / delete)
// ---------------------------------------------------------------------------

void _showCardDetail(BuildContext context, StoredCard card) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _CardDetailSheet(card: card),
  );
}

class _CardDetailSheet extends ConsumerStatefulWidget {
  final StoredCard card;

  const _CardDetailSheet({required this.card});

  @override
  ConsumerState<_CardDetailSheet> createState() => _CardDetailSheetState();
}

class _CardDetailSheetState extends ConsumerState<_CardDetailSheet> {
  StoredCardReveal? _revealed;
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
      final r =
          await ref.read(storedCardsServiceProvider).reveal(widget.card.id);
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
      final r = await ref.read(storedCardsServiceProvider).copy(widget.card.id);
      await Clipboard.setData(ClipboardData(text: r.cardNumber));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Número copiado.')),
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
      await ref.read(storedCardsServiceProvider).toggleFavorite(widget.card.id);
      ref.invalidate(storedCardsProvider);
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
      title: 'Excluir cartão',
      message: 'Excluir "${widget.card.name}" do cofre? '
          'Essa ação não pode ser desfeita.',
    );
    if (!ok) return;
    try {
      await ref.read(storedCardsServiceProvider).delete(widget.card.id);
      ref.invalidate(storedCardsProvider);
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
    final card = widget.card;
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          bottom: AppSpacing.md + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(card.name, style: theme.textTheme.titleLarge),
                ),
                IconButton(
                  icon: Icon(
                    card.isFavorite
                        ? Icons.star_rounded
                        : Icons.star_outline_rounded,
                    color: card.isFavorite ? Colors.amber : null,
                  ),
                  onPressed: _toggleFavorite,
                ),
              ],
            ),
            Text(
              ChoiceLabels.of(ChoiceLabels.storedCardFlags, card.flag),
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            SizedBox(height: AppSpacing.md),
            if (card.cardholderName != null)
              _Row(label: 'Titular', value: card.cardholderName!),
            _Row(label: 'Validade', value: card.expiry),
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
                            _revealed!.cardNumber,
                            style: theme.textTheme.titleMedium
                                ?.copyWith(fontFamily: 'monospace'),
                          ),
                        ),
                        Text('${_secondsLeft}s',
                            style: theme.textTheme.labelSmall),
                      ],
                    ),
                    SelectableText(
                      'CVV ${_revealed!.securityCode}',
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(fontFamily: 'monospace'),
                    ),
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
                label: const Text('Revelar número e CVV'),
              ),
            if (card.notes != null) ...[
              SizedBox(height: AppSpacing.sm),
              _Row(label: 'Notas', value: card.notes!),
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
                    await _showCardForm(context, existing: card);
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
    );
  }
}

// ---------------------------------------------------------------------------
// Form sheet
// ---------------------------------------------------------------------------

Future<bool?> _showCardForm(BuildContext context, {StoredCard? existing}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _CardFormSheet(existing: existing),
  );
}

class _CardFormSheet extends ConsumerStatefulWidget {
  final StoredCard? existing;

  const _CardFormSheet({this.existing});

  @override
  ConsumerState<_CardFormSheet> createState() => _CardFormSheetState();
}

class _CardFormSheetState extends ConsumerState<_CardFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _numberController;
  late final TextEditingController _cvvController;
  late final TextEditingController _holderController;
  late final TextEditingController _monthController;
  late final TextEditingController _yearController;
  late final TextEditingController _notesController;
  String _flag = 'OTHER';
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _nameController = TextEditingController(text: e?.name ?? '');
    _numberController = TextEditingController();
    _cvvController = TextEditingController();
    _holderController = TextEditingController(text: e?.cardholderName ?? '');
    _monthController =
        TextEditingController(text: e?.expirationMonth?.toString() ?? '');
    _yearController =
        TextEditingController(text: e?.expirationYear?.toString() ?? '');
    _notesController = TextEditingController(text: e?.notes ?? '');
    _flag = e?.flag ?? 'OTHER';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _numberController.dispose();
    _cvvController.dispose();
    _holderController.dispose();
    _monthController.dispose();
    _yearController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final card = StoredCard(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      name: _nameController.text.trim(),
      cardholderName: _holderController.text.trim().isEmpty
          ? null
          : _holderController.text.trim(),
      expirationMonth: int.tryParse(_monthController.text),
      expirationYear: int.tryParse(_yearController.text),
      flag: _flag,
      notes: _notesController.text.trim(),
      isFavorite: widget.existing?.isFavorite ?? false,
    );

    final service = ref.read(storedCardsServiceProvider);
    try {
      final payload = card.toJson(
        cardNumber: _numberController.text.isEmpty
            ? null
            : _numberController.text.trim(),
        securityCode:
            _cvvController.text.isEmpty ? null : _cvvController.text.trim(),
      );
      if (widget.existing == null) {
        await service.create(payload);
      } else {
        await service.update(widget.existing!.id, payload);
      }
      ref.invalidate(storedCardsProvider);
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
              Text(isEditing ? 'Editar cartão' : 'Novo cartão',
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
                controller: _numberController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: isEditing
                      ? 'Número (deixe em branco para manter)'
                      : 'Número do cartão',
                ),
                validator: (v) => (!isEditing && (v == null || v.isEmpty))
                    ? 'Informe o número'
                    : null,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _cvvController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText:
                      isEditing ? 'CVV (deixe em branco para manter)' : 'CVV',
                ),
                validator: (v) => (!isEditing && (v == null || v.isEmpty))
                    ? 'Informe o CVV'
                    : null,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _holderController,
                decoration:
                    const InputDecoration(labelText: 'Titular (opcional)'),
              ),
              SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _monthController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Mês'),
                    ),
                  ),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: TextFormField(
                      controller: _yearController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Ano'),
                    ),
                  ),
                ],
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: _flag,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Bandeira'),
                items: ChoiceLabels.storedCardFlags.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _flag = v!),
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
