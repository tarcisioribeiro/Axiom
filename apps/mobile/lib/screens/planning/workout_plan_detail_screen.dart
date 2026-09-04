import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/workout_day.dart';
import '../../models/workout_exercise.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';
import '../../widgets/app_card.dart';
import '../../widgets/confirm.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/row_actions.dart';

/// Nested editing of a workout plan: its days, and the exercises inside each
/// day. Reached from the "Planos" tab of the Treino screen.
class WorkoutPlanDetailScreen extends ConsumerWidget {
  final int planId;
  final String planName;

  const WorkoutPlanDetailScreen({
    super.key,
    required this.planId,
    required this.planName,
  });

  Future<void> _deleteDay(
      BuildContext context, WidgetRef ref, WorkoutDay day) async {
    try {
      await ref.read(workoutDaysServiceProvider).delete(day.id);
      ref.invalidate(workoutDaysProvider(planId));
      ref.invalidate(workoutPlansProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final daysAsync = ref.watch(workoutDaysProvider(planId));

    return Scaffold(
      appBar: AppBar(title: Text(planName)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showDayForm(context, ref, planId),
        icon: const Icon(Icons.add),
        label: const Text('Dia'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(workoutDaysProvider(planId));
          await ref.read(workoutDaysProvider(planId).future);
        },
        child: daysAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (e, _) => Center(child: Text('Erro: $e')),
          data: (days) {
            if (days.isEmpty) {
              return const EmptyState(
                icon: Icons.calendar_view_week_outlined,
                title: 'Nenhum dia neste plano',
              );
            }
            final sorted = [...days]
              ..sort((a, b) => a.order.compareTo(b.order));
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: sorted
                  .map((day) => _DayCard(
                        day: day,
                        planId: planId,
                        onEdit: () =>
                            _showDayForm(context, ref, planId, existing: day),
                        onDelete: () => _deleteDay(context, ref, day),
                      ))
                  .toList(),
            );
          },
        ),
      ),
    );
  }
}

class _DayCard extends ConsumerWidget {
  final WorkoutDay day;
  final int planId;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _DayCard({
    required this.day,
    required this.planId,
    required this.onEdit,
    required this.onDelete,
  });

  Future<void> _deleteExercise(
      BuildContext context, WidgetRef ref, WorkoutExercise ex) async {
    try {
      await ref.read(workoutExercisesServiceProvider).delete(ex.id);
      ref.invalidate(workoutDaysProvider(planId));
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final exercises = [...day.exercises]
      ..sort((a, b) => a.order.compareTo(b.order));

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.smd,
        AppSpacing.xs,
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
                    Text(day.name, style: theme.textTheme.titleSmall),
                    Text(
                      [
                        if (day.muscleGroups?.isNotEmpty ?? false)
                          day.muscleGroups!,
                        if (day.dayOfWeek != null)
                          ChoiceLabels.weekdays[day.dayOfWeek] ?? '',
                      ].where((s) => s.isNotEmpty).join(' · '),
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
                deleteConfirmTitle: 'Excluir dia',
                deleteConfirmMessage:
                    'Excluir "${day.name}" e seus exercícios?',
              ),
            ],
          ),
          const Divider(height: AppSpacing.md),
          if (exercises.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Text('Nenhum exercício',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  )),
            )
          else
            ...exercises.map((ex) => Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${ex.name} · ${ex.sets}x'
                          '${ex.repsLabel.isEmpty ? '' : ' ${ex.repsLabel}'}'
                          '${ex.load == null ? '' : ' · ${ex.load}kg'}',
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                      InkWell(
                        onTap: () => _showExerciseForm(context, ref, day.id,
                            planId: planId, existing: ex),
                        child: const Padding(
                          padding: EdgeInsets.all(4),
                          child: Icon(Icons.edit_outlined, size: 16),
                        ),
                      ),
                      InkWell(
                        onTap: () async {
                          final ok = await confirmDelete(context,
                              title: 'Excluir exercício',
                              message: 'Excluir "${ex.name}"?');
                          if (ok) {
                            await _deleteExercise(context, ref, ex);
                          }
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: Icon(Icons.delete_outline,
                              size: 16, color: theme.colorScheme.error),
                        ),
                      ),
                    ],
                  ),
                )),
          SizedBox(height: AppSpacing.xs),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => _showExerciseForm(context, ref, day.id,
                  planId: planId, nextOrder: exercises.length),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Exercício'),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Day form
// ---------------------------------------------------------------------------

Future<void> _showDayForm(
  BuildContext context,
  WidgetRef ref,
  int planId, {
  WorkoutDay? existing,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _DayFormSheet(planId: planId, existing: existing),
  );
}

class _DayFormSheet extends ConsumerStatefulWidget {
  final int planId;
  final WorkoutDay? existing;

  const _DayFormSheet({required this.planId, this.existing});

  @override
  ConsumerState<_DayFormSheet> createState() => _DayFormSheetState();
}

class _DayFormSheetState extends ConsumerState<_DayFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _muscleController;
  late final TextEditingController _orderController;
  int? _dayOfWeek;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _nameController = TextEditingController(text: e?.name ?? '');
    _muscleController = TextEditingController(text: e?.muscleGroups ?? '');
    _orderController = TextEditingController(text: '${e?.order ?? 0}');
    _dayOfWeek = e?.dayOfWeek;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _muscleController.dispose();
    _orderController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });
    final day = WorkoutDay(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      plan: widget.planId,
      name: _nameController.text.trim(),
      muscleGroups: _muscleController.text.trim().isEmpty
          ? null
          : _muscleController.text.trim(),
      dayOfWeek: _dayOfWeek,
      order: int.tryParse(_orderController.text) ?? 0,
      exerciseCount: 0,
      exercises: const [],
    );
    final service = ref.read(workoutDaysServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(day.toJson());
      } else {
        await service.update(widget.existing!.id, day.toJson());
      }
      ref.invalidate(workoutDaysProvider(widget.planId));
      ref.invalidate(workoutPlansProvider);
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
              Text(widget.existing == null ? 'Novo dia' : 'Editar dia',
                  style: Theme.of(context).textTheme.titleMedium),
              SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _nameController,
                decoration:
                    const InputDecoration(labelText: 'Nome (ex: Treino A)'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Informe um nome' : null,
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _muscleController,
                decoration: const InputDecoration(
                    labelText: 'Grupos musculares (opcional)'),
              ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<int?>(
                value: _dayOfWeek,
                decoration: const InputDecoration(
                    labelText: 'Dia da semana (opcional)'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('—')),
                  ...ChoiceLabels.weekdays.entries.map((e) =>
                      DropdownMenuItem(value: e.key, child: Text(e.value))),
                ],
                onChanged: (v) => setState(() => _dayOfWeek = v),
              ),
              SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _orderController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Ordem'),
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

// ---------------------------------------------------------------------------
// Exercise form
// ---------------------------------------------------------------------------

Future<void> _showExerciseForm(
  BuildContext context,
  WidgetRef ref,
  int dayId, {
  required int planId,
  WorkoutExercise? existing,
  int nextOrder = 0,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _ExerciseFormSheet(
      dayId: dayId,
      planId: planId,
      existing: existing,
      nextOrder: nextOrder,
    ),
  );
}

class _ExerciseFormSheet extends ConsumerStatefulWidget {
  final int dayId;
  final int planId;
  final WorkoutExercise? existing;
  final int nextOrder;

  const _ExerciseFormSheet({
    required this.dayId,
    required this.planId,
    required this.nextOrder,
    this.existing,
  });

  @override
  ConsumerState<_ExerciseFormSheet> createState() => _ExerciseFormSheetState();
}

class _ExerciseFormSheetState extends ConsumerState<_ExerciseFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _setsController;
  late final TextEditingController _repsMinController;
  late final TextEditingController _repsMaxController;
  late final TextEditingController _restController;
  late final TextEditingController _loadController;
  late final TextEditingController _notesController;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _nameController = TextEditingController(text: e?.name ?? '');
    _setsController = TextEditingController(text: '${e?.sets ?? 3}');
    _repsMinController =
        TextEditingController(text: e?.repsMin?.toString() ?? '');
    _repsMaxController =
        TextEditingController(text: e?.repsMax?.toString() ?? '');
    _restController =
        TextEditingController(text: e?.restSeconds?.toString() ?? '');
    _loadController = TextEditingController(text: e?.load?.toString() ?? '');
    _notesController = TextEditingController(text: e?.notes ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _setsController.dispose();
    _repsMinController.dispose();
    _repsMaxController.dispose();
    _restController.dispose();
    _loadController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });
    final ex = WorkoutExercise(
      id: widget.existing?.id ?? 0,
      uuid: widget.existing?.uuid ?? '',
      workoutDay: widget.dayId,
      exercise: widget.existing?.exercise,
      name: _nameController.text.trim(),
      sets: int.tryParse(_setsController.text) ?? 3,
      repsMin: int.tryParse(_repsMinController.text),
      repsMax: int.tryParse(_repsMaxController.text),
      restSeconds: int.tryParse(_restController.text),
      load: double.tryParse(_loadController.text.replaceAll(',', '.')),
      order: widget.existing?.order ?? widget.nextOrder,
      notes: _notesController.text.trim(),
    );
    final service = ref.read(workoutExercisesServiceProvider);
    try {
      if (widget.existing == null) {
        await service.create(ex.toJson());
      } else {
        await service.update(widget.existing!.id, ex.toJson());
      }
      ref.invalidate(workoutDaysProvider(widget.planId));
      ref.invalidate(workoutPlansProvider);
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
                    widget.existing == null
                        ? 'Novo exercício'
                        : 'Editar exercício',
                    style: Theme.of(context).textTheme.titleMedium),
                SizedBox(height: AppSpacing.md),
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: 'Nome'),
                  validator: (v) =>
                      (v == null || v.isEmpty) ? 'Informe um nome' : null,
                ),
                SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _setsController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Séries'),
                      ),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: TextFormField(
                        controller: _restController,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Descanso (s)'),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _repsMinController,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Reps mín.'),
                      ),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: TextFormField(
                        controller: _repsMaxController,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Reps máx.'),
                      ),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: TextFormField(
                        controller: _loadController,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        decoration:
                            const InputDecoration(labelText: 'Carga (kg)'),
                      ),
                    ),
                  ],
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
