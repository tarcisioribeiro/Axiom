import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../models/vault.dart';
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
import '../../widgets/stat_card.dart';

/// Cofres — reservas atreladas a uma conta, com rendimento anual opcional.
/// A mecânica de rendimento (receita/saldo) é toda do backend; o app só
/// dispara depósito / saque / aplicar rendimento e mostra o extrato.
class VaultsScreen extends ConsumerWidget {
  const VaultsScreen({super.key});

  Future<void> _delete(BuildContext context, WidgetRef ref, Vault v) async {
    try {
      await ref.read(vaultsServiceProvider).delete(v.id);
      ref.invalidate(vaultsProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _move(
    BuildContext context,
    WidgetRef ref,
    Vault v, {
    required bool isWithdraw,
  }) async {
    final amount = await _promptAmount(
      context,
      title: isWithdraw ? 'Sacar do cofre' : 'Depositar no cofre',
      actionLabel: isWithdraw ? 'Sacar' : 'Depositar',
    );
    if (amount == null) return;
    try {
      final service = ref.read(vaultsServiceProvider);
      if (isWithdraw) {
        await service.withdraw(v.id, amount: amount);
      } else {
        await service.deposit(v.id, amount: amount);
      }
      ref.invalidate(vaultsProvider);
      ref.invalidate(vaultTransactionsProvider(v.id));
      ref.invalidate(accountsProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _applyYield(BuildContext context, WidgetRef ref, Vault v) async {
    try {
      await ref.read(vaultsServiceProvider).applyYield(v.id);
      ref.invalidate(vaultsProvider);
      ref.invalidate(vaultTransactionsProvider(v.id));
      ref.invalidate(accountsProvider);
      ref.invalidate(revenuesProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Rendimento aplicado.')),
        );
      }
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vaultsAsync = ref.watch(vaultsProvider);
    final accounts = ref.watch(accountsProvider).valueOrNull ?? const [];

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: accounts.isEmpty
            ? null
            : () => _showVaultForm(context, ref, accounts: accounts),
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(vaultsProvider);
            await ref.read(vaultsProvider.future);
          },
          child: vaultsAsync.when(
            loading: () => const LoadingState(variant: LoadingVariant.list),
            error: (e, _) => Center(child: Text('Erro: $e')),
            data: (vaults) {
              final reserved =
                  vaults.fold<double>(0, (s, v) => s + v.currentBalance);
              final yieldTotal =
                  vaults.fold<double>(0, (s, v) => s + v.accumulatedYield);

              return ListView(
                padding: const EdgeInsets.all(AppSpacing.md),
                children: [
                  AppPageHeader(
                    title: 'Cofres',
                    icon: Icons.savings_outlined,
                    color: context.semanticColors.success,
                  ),
                  SizedBox(height: AppSpacing.md),
                  Row(
                    children: [
                      Expanded(
                        child: StatCard(
                          title: 'Reservado',
                          value: AppFormatters.currency(reserved),
                          icon: Icons.lock_outline_rounded,
                          accent: StatAccent.primary,
                        ),
                      ),
                      SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: StatCard(
                          title: 'Rendimentos',
                          value: AppFormatters.currency(yieldTotal),
                          icon: Icons.trending_up_rounded,
                          accent: StatAccent.success,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: AppSpacing.md),
                  if (vaults.isEmpty)
                    const EmptyState(
                      icon: Icons.savings_outlined,
                      title: 'Nenhum cofre criado',
                    )
                  else
                    ...vaults.map(
                      (v) => _VaultTile(
                        vault: v,
                        onDeposit: () =>
                            _move(context, ref, v, isWithdraw: false),
                        onWithdraw: () =>
                            _move(context, ref, v, isWithdraw: true),
                        onApplyYield: v.pendingYield <= 0
                            ? null
                            : () => _applyYield(context, ref, v),
                        onTransactions: () =>
                            _showTransactions(context, ref, v),
                        onEdit: () => _showVaultForm(context, ref,
                            accounts: accounts, existing: v),
                        onDelete: () => _delete(context, ref, v),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  void _showTransactions(BuildContext context, WidgetRef ref, Vault v) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => Consumer(
        builder: (context, ref, _) {
          final txAsync = ref.watch(vaultTransactionsProvider(v.id));
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Extrato — ${v.description}',
                      style: Theme.of(context).textTheme.titleMedium),
                  SizedBox(height: AppSpacing.sm),
                  txAsync.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.all(AppSpacing.md),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    error: (e, _) => Text('Erro: $e'),
                    data: (txs) => txs.isEmpty
                        ? const Padding(
                            padding: EdgeInsets.all(AppSpacing.sm),
                            child: Text('Nenhuma movimentação.'),
                          )
                        : Flexible(
                            child: ListView(
                              shrinkWrap: true,
                              children: txs
                                  .map((t) => ListTile(
                                        dense: true,
                                        contentPadding: EdgeInsets.zero,
                                        title: Text(
                                            t.description?.isNotEmpty == true
                                                ? t.description!
                                                : ChoiceLabels.of(
                                                    ChoiceLabels
                                                        .vaultTransactionTypes,
                                                    t.transactionType)),
                                        subtitle: Text(
                                          '${t.transactionDate == null ? '' : '${AppFormatters.date(t.transactionDate!)} · '}'
                                          'saldo ${AppFormatters.currency(t.balanceAfter)}',
                                        ),
                                        trailing: Text(
                                          '${t.transactionType == 'withdrawal' ? '-' : '+'}'
                                          '${AppFormatters.currency(t.amount)}',
                                        ),
                                      ))
                                  .toList(),
                            ),
                          ),
                  ),
                  SizedBox(height: AppSpacing.md),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

Future<double?> _promptAmount(
  BuildContext context, {
  required String title,
  required String actionLabel,
}) {
  final controller = TextEditingController();
  return showDialog<double>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        autofocus: true,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: const InputDecoration(labelText: 'Valor'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () {
            final v =
                double.tryParse(controller.text.replaceAll(',', '.')) ?? 0;
            Navigator.of(context).pop(v > 0 ? v : null);
          },
          child: Text(actionLabel),
        ),
      ],
    ),
  );
}

class _VaultTile extends StatelessWidget {
  final Vault vault;
  final VoidCallback onDeposit;
  final VoidCallback onWithdraw;
  final VoidCallback? onApplyYield;
  final VoidCallback onTransactions;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _VaultTile({
    required this.vault,
    required this.onDeposit,
    required this.onWithdraw,
    required this.onApplyYield,
    required this.onTransactions,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.smd,
        AppSpacing.smd,
        AppSpacing.sm,
        AppSpacing.smd,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(vault.description, style: theme.textTheme.titleSmall),
                    Text(
                      '${vault.accountName ?? '—'} · '
                      '${vault.annualYieldRatePercentage.toStringAsFixed(2)}% a.a.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                AppFormatters.currency(vault.currentBalance),
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              RowActionsMenu(
                onEdit: onEdit,
                onDelete: onDelete,
                deleteConfirmTitle: 'Excluir cofre',
                deleteConfirmMessage:
                    'Excluir "${vault.description}"? Essa ação não pode ser desfeita.',
              ),
            ],
          ),
          Text(
            'Principal ${AppFormatters.currency(vault.principal)} · '
            'rendimento ${AppFormatters.currency(vault.accumulatedYield)}'
            '${vault.pendingYield > 0 ? ' · pendente ${AppFormatters.currency(vault.pendingYield)}' : ''}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.sm,
            children: [
              FilledButton.tonal(
                onPressed: onDeposit,
                style: FilledButton.styleFrom(
                    visualDensity: VisualDensity.compact),
                child: const Text('Depositar'),
              ),
              OutlinedButton(
                onPressed: onWithdraw,
                style: OutlinedButton.styleFrom(
                    visualDensity: VisualDensity.compact),
                child: const Text('Sacar'),
              ),
              if (onApplyYield != null)
                TextButton(
                  onPressed: onApplyYield,
                  style: TextButton.styleFrom(
                      visualDensity: VisualDensity.compact),
                  child: const Text('Aplicar rend.'),
                ),
              TextButton(
                onPressed: onTransactions,
                style:
                    TextButton.styleFrom(visualDensity: VisualDensity.compact),
                child: const Text('Extrato'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Form sheet
// ---------------------------------------------------------------------------

Future<bool?> _showVaultForm(
  BuildContext context,
  WidgetRef ref, {
  required List<Account> accounts,
  Vault? existing,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _VaultFormSheet(accounts: accounts, existing: existing),
  );
}

class _VaultFormSheet extends ConsumerStatefulWidget {
  final List<Account> accounts;
  final Vault? existing;

  const _VaultFormSheet({required this.accounts, this.existing});

  @override
  ConsumerState<_VaultFormSheet> createState() => _VaultFormSheetState();
}

class _VaultFormSheetState extends ConsumerState<_VaultFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _descriptionController;
  late final TextEditingController _rateController;
  late final TextEditingController _notesController;
  int? _accountId;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _descriptionController = TextEditingController(text: e?.description ?? '');
    // Rate is stored as a fraction (0.12); the field shows a percentage.
    _rateController = TextEditingController(
      text: e == null ? '' : (e.annualYieldRate * 100).toStringAsFixed(2),
    );
    _notesController = TextEditingController(text: e?.notes ?? '');
    _accountId = e?.account ??
        (widget.accounts.isEmpty ? null : widget.accounts.first.id);
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _rateController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_accountId == null) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final ratePercent =
        double.tryParse(_rateController.text.replaceAll(',', '.')) ?? 0;
    final vault = Vault(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      description: _descriptionController.text.trim(),
      account: _accountId!,
      currentBalance: widget.existing?.currentBalance ?? 0,
      accumulatedYield: widget.existing?.accumulatedYield ?? 0,
      annualYieldRate: ratePercent / 100,
      annualYieldRatePercentage: ratePercent,
      pendingYield: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      isActive: widget.existing?.isActive ?? true,
      notes: _notesController.text.trim(),
    );

    final service = ref.read(vaultsServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(vault.toJson());
      } else {
        await service.update(widget.existing!.id, vault.toJson());
      }
      ref.invalidate(vaultsProvider);
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
              Text(isEditing ? 'Editar cofre' : 'Novo cofre',
                  style: Theme.of(context).textTheme.titleMedium),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(labelText: 'Descrição'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe uma descrição' : null,
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
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _rateController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Rendimento anual (%)',
                  hintText: 'ex: 12',
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
              SizedBox(height: AppSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }
}
