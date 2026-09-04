import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/financial_goal.dart';
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

/// Metas financeiras — agregam cofres e acompanham o progresso até um valor
/// alvo. Mirror do `FinancialGoals` do web (fluxo de uso diário: listar,
/// criar/editar, vincular cofres).
class FinancialGoalsScreen extends ConsumerWidget {
  const FinancialGoalsScreen({super.key});

  Future<void> _delete(
      BuildContext context, WidgetRef ref, FinancialGoal g) async {
    try {
      await ref.read(financialGoalsServiceProvider).delete(g.id);
      ref.invalidate(financialGoalsProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goalsAsync = ref.watch(financialGoalsProvider);
    // Kept warm for the "manage vaults" sheet.
    ref.watch(vaultsProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showGoalForm(context),
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(financialGoalsProvider);
            await ref.read(financialGoalsProvider.future);
          },
          child: goalsAsync.when(
            loading: () => const LoadingState(variant: LoadingVariant.list),
            error: (e, _) => Center(child: Text('Erro: $e')),
            data: (goals) => ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                AppPageHeader(
                  title: 'Metas financeiras',
                  icon: Icons.flag_outlined,
                  color: context.semanticColors.success,
                ),
                SizedBox(height: AppSpacing.md),
                if (goals.isEmpty)
                  const EmptyState(
                    icon: Icons.flag_outlined,
                    title: 'Nenhuma meta criada',
                  )
                else
                  ...goals.map(
                    (g) => _GoalTile(
                      goal: g,
                      onManageVaults: () => _showManageVaults(context, ref, g),
                      onEdit: () => _showGoalForm(context, existing: g),
                      onDelete: () => _delete(context, ref, g),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showManageVaults(
      BuildContext context, WidgetRef ref, FinancialGoal goal) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _ManageVaultsSheet(goal: goal),
    );
  }
}

class _GoalTile extends StatelessWidget {
  final FinancialGoal goal;
  final VoidCallback onManageVaults;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _GoalTile({
    required this.goal,
    required this.onManageVaults,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      accentColor: goal.isCompleted ? context.semanticColors.success : null,
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
                    Text(goal.description, style: theme.textTheme.titleSmall),
                    Text(
                      '${goal.categoryDisplay ?? ChoiceLabels.of(ChoiceLabels.goalCategories, goal.category)}'
                      ' · ${goal.vaultsCount} cofre(s)'
                      '${goal.targetDate == null ? '' : ' · até ${AppFormatters.date(goal.targetDate!)}'}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              RowActionsMenu(
                onEdit: onEdit,
                onDelete: onDelete,
                deleteConfirmTitle: 'Excluir meta',
                deleteConfirmMessage:
                    'Excluir "${goal.description}"? Essa ação não pode ser desfeita.',
              ),
            ],
          ),
          SizedBox(height: AppSpacing.xs),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: goal.progress,
              minHeight: 6,
              backgroundColor: theme.colorScheme.surfaceContainerHighest,
            ),
          ),
          SizedBox(height: AppSpacing.xs),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${AppFormatters.currency(goal.currentValue)} de '
                '${AppFormatters.currency(goal.targetValue)}'
                ' (${goal.progressPercentage.toStringAsFixed(0)}%)',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              TextButton(
                onPressed: onManageVaults,
                style:
                    TextButton.styleFrom(visualDensity: VisualDensity.compact),
                child: const Text('Cofres'),
              ),
            ],
          ),
          if (goal.monthlyRequired != null && !goal.isCompleted)
            Text(
              'Aporte mensal necessário: ${AppFormatters.currency(goal.monthlyRequired)}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Manage linked vaults
// ---------------------------------------------------------------------------

class _ManageVaultsSheet extends ConsumerStatefulWidget {
  final FinancialGoal goal;

  const _ManageVaultsSheet({required this.goal});

  @override
  ConsumerState<_ManageVaultsSheet> createState() => _ManageVaultsSheetState();
}

class _ManageVaultsSheetState extends ConsumerState<_ManageVaultsSheet> {
  late Set<int> _selected;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selected = widget.goal.vaults.toSet();
  }

  Future<void> _save() async {
    setState(() {
      _isSaving = true;
      _error = null;
    });
    final original = widget.goal.vaults.toSet();
    final toAdd = _selected.difference(original).toList();
    final toRemove = original.difference(_selected).toList();
    final service = ref.read(financialGoalsServiceProvider);
    try {
      if (toAdd.isNotEmpty) await service.addVaults(widget.goal.id, toAdd);
      if (toRemove.isNotEmpty) {
        await service.removeVaults(widget.goal.id, toRemove);
      }
      ref.invalidate(financialGoalsProvider);
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final vaults = ref.watch(vaultsProvider).valueOrNull ?? const <Vault>[];
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
            Text('Cofres da meta — ${widget.goal.description}',
                style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: AppSpacing.sm),
            if (vaults.isEmpty)
              const Padding(
                padding: EdgeInsets.all(AppSpacing.sm),
                child: Text('Nenhum cofre disponível. Crie um cofre primeiro.'),
              )
            else
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: vaults
                      .map((v) => CheckboxListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(v.description),
                            subtitle:
                                Text(AppFormatters.currency(v.currentBalance)),
                            value: _selected.contains(v.id),
                            onChanged: (checked) => setState(() {
                              if (checked ?? false) {
                                _selected.add(v.id);
                              } else {
                                _selected.remove(v.id);
                              }
                            }),
                          ))
                      .toList(),
                ),
              ),
            if (_error != null) ...[
              SizedBox(height: AppSpacing.sm),
              Text(_error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _isSaving || vaults.isEmpty ? null : _save,
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
    );
  }
}

// ---------------------------------------------------------------------------
// Goal form
// ---------------------------------------------------------------------------

Future<bool?> _showGoalForm(BuildContext context, {FinancialGoal? existing}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _GoalFormSheet(existing: existing),
  );
}

class _GoalFormSheet extends ConsumerStatefulWidget {
  final FinancialGoal? existing;

  const _GoalFormSheet({this.existing});

  @override
  ConsumerState<_GoalFormSheet> createState() => _GoalFormSheetState();
}

class _GoalFormSheetState extends ConsumerState<_GoalFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _descriptionController;
  late final TextEditingController _targetController;
  late final TextEditingController _notesController;
  String _category = 'savings';
  DateTime? _targetDate;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _descriptionController = TextEditingController(text: e?.description ?? '');
    _targetController = TextEditingController(
      text: e == null ? '' : e.targetValue.toStringAsFixed(2),
    );
    _notesController = TextEditingController(text: e?.notes ?? '');
    _category = e?.category ?? 'savings';
    _targetDate = e?.targetDate;
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _targetController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _targetDate ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _targetDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });

    final goal = FinancialGoal(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      description: _descriptionController.text.trim(),
      category: _category,
      targetValue:
          double.tryParse(_targetController.text.replaceAll(',', '.')) ?? 0,
      currentValue: widget.existing?.currentValue ?? 0,
      progressPercentage: widget.existing?.progressPercentage ?? 0,
      remainingValue: widget.existing?.remainingValue ?? 0,
      isActive: widget.existing?.isActive ?? true,
      isCompleted: widget.existing?.isCompleted ?? false,
      vaultsCount: widget.existing?.vaultsCount ?? 0,
      vaults: widget.existing?.vaults ?? const [],
      targetDate: _targetDate,
      notes: _notesController.text.trim(),
    );

    final service = ref.read(financialGoalsServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(goal.toJson());
      } else {
        await service.update(widget.existing!.id, goal.toJson());
      }
      ref.invalidate(financialGoalsProvider);
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
              Text(isEditing ? 'Editar meta' : 'Nova meta',
                  style: Theme.of(context).textTheme.titleMedium),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(labelText: 'Descrição'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe uma descrição' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _targetController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Valor alvo'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe o valor alvo' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: _category,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Categoria'),
                items: ChoiceLabels.goalCategories.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _category = v!),
              ),
              SizedBox(height: AppSpacing.sm),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Data alvo (opcional)'),
                subtitle: Text(
                  _targetDate == null ? '—' : AppFormatters.date(_targetDate!),
                ),
                trailing: _targetDate == null
                    ? const Icon(Icons.calendar_today_outlined, size: 18)
                    : IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () => setState(() => _targetDate = null),
                      ),
                onTap: _pickDate,
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
