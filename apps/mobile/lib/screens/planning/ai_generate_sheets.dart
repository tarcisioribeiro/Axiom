import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';

/// Bottom sheet that collects a few parameters and calls the backend AI
/// generator. The backend persists the result (workout plan / meal types),
/// so on success we just invalidate the relevant list and show a summary.

Future<void> showAiWorkoutPlanSheet(BuildContext context, WidgetRef ref) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const _AiWorkoutSheet(),
  );
}

Future<void> showAiMenuPlanSheet(BuildContext context, WidgetRef ref) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const _AiMenuSheet(),
  );
}

class _AiWorkoutSheet extends ConsumerStatefulWidget {
  const _AiWorkoutSheet();

  @override
  ConsumerState<_AiWorkoutSheet> createState() => _AiWorkoutSheetState();
}

class _AiWorkoutSheetState extends ConsumerState<_AiWorkoutSheet> {
  final _goalController = TextEditingController();
  final _equipmentController = TextEditingController(text: 'academia completa');
  String _level = 'iniciante';
  int _days = 3;
  bool _loading = false;
  String? _error;
  String? _result;

  @override
  void dispose() {
    _goalController.dispose();
    _equipmentController.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    final goal = _goalController.text.trim();
    if (goal.isEmpty) {
      setState(() => _error = 'Informe o objetivo.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });
    try {
      final res =
          await ref.read(planningExtrasServiceProvider).generateWorkoutPlan(
                goal: goal,
                level: _level,
                equipment: _equipmentController.text.trim(),
                daysPerWeek: _days,
              );
      ref.invalidate(workoutPlansProvider);
      setState(() => _result = 'Plano "${res['name'] ?? 'gerado'}" criado com '
          '${res['days_created'] ?? '?'} dia(s).');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _AiSheetScaffold(
      title: 'Gerar plano de treino com IA',
      loading: _loading,
      error: _error,
      result: _result,
      onGenerate: _generate,
      onClose: () => Navigator.of(context).pop(),
      fields: [
        TextField(
          controller: _goalController,
          decoration: const InputDecoration(
            labelText: 'Objetivo',
            hintText: 'ex: hipertrofia, emagrecer, condicionamento',
          ),
        ),
        SizedBox(height: AppSpacing.sm),
        DropdownButtonFormField<String>(
          value: _level,
          decoration: const InputDecoration(labelText: 'Nível'),
          items: const [
            DropdownMenuItem(value: 'iniciante', child: Text('Iniciante')),
            DropdownMenuItem(
                value: 'intermediário', child: Text('Intermediário')),
            DropdownMenuItem(value: 'avançado', child: Text('Avançado')),
          ],
          onChanged: (v) => setState(() => _level = v!),
        ),
        SizedBox(height: AppSpacing.sm),
        TextField(
          controller: _equipmentController,
          decoration: const InputDecoration(labelText: 'Equipamentos'),
        ),
        SizedBox(height: AppSpacing.sm),
        _DaysStepper(
          label: 'Dias por semana',
          value: _days,
          min: 1,
          max: 7,
          onChanged: (v) => setState(() => _days = v),
        ),
      ],
    );
  }
}

class _AiMenuSheet extends ConsumerStatefulWidget {
  const _AiMenuSheet();

  @override
  ConsumerState<_AiMenuSheet> createState() => _AiMenuSheetState();
}

class _AiMenuSheetState extends ConsumerState<_AiMenuSheet> {
  final _caloriesController = TextEditingController(text: '2000');
  final _preferencesController = TextEditingController();
  final _restrictionsController = TextEditingController();
  int _meals = 3;
  bool _loading = false;
  String? _error;
  String? _result;

  @override
  void dispose() {
    _caloriesController.dispose();
    _preferencesController.dispose();
    _restrictionsController.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });
    try {
      final res =
          await ref.read(planningExtrasServiceProvider).generateMenuPlan(
                calories: int.tryParse(_caloriesController.text) ?? 2000,
                preferences: _preferencesController.text.trim(),
                restrictions: _restrictionsController.text.trim(),
                mealsPerDay: _meals,
              );
      ref.invalidate(mealTypesProvider);
      setState(() => _result =
          'Cardápio criado com ${res['meal_types_created'] ?? res['days_created'] ?? '?'} '
              'tipo(s) de refeição.');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _AiSheetScaffold(
      title: 'Gerar cardápio com IA',
      loading: _loading,
      error: _error,
      result: _result,
      onGenerate: _generate,
      onClose: () => Navigator.of(context).pop(),
      fields: [
        TextField(
          controller: _caloriesController,
          keyboardType: TextInputType.number,
          decoration:
              const InputDecoration(labelText: 'Objetivo calórico diário'),
        ),
        SizedBox(height: AppSpacing.sm),
        TextField(
          controller: _preferencesController,
          decoration: const InputDecoration(
            labelText: 'Preferências (opcional)',
            hintText: 'ex: comida brasileira, low carb',
          ),
        ),
        SizedBox(height: AppSpacing.sm),
        TextField(
          controller: _restrictionsController,
          decoration: const InputDecoration(
            labelText: 'Restrições (opcional)',
            hintText: 'ex: sem lactose, vegetariano',
          ),
        ),
        SizedBox(height: AppSpacing.sm),
        _DaysStepper(
          label: 'Refeições por dia',
          value: _meals,
          min: 2,
          max: 6,
          onChanged: (v) => setState(() => _meals = v),
        ),
      ],
    );
  }
}

class _AiSheetScaffold extends StatelessWidget {
  final String title;
  final List<Widget> fields;
  final bool loading;
  final String? error;
  final String? result;
  final VoidCallback onGenerate;
  final VoidCallback onClose;

  const _AiSheetScaffold({
    required this.title,
    required this.fields,
    required this.loading,
    required this.error,
    required this.result,
    required this.onGenerate,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
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
              Text(title, style: theme.textTheme.titleMedium),
              SizedBox(height: AppSpacing.md),
              if (result != null)
                Text(result!,
                    style: TextStyle(color: theme.colorScheme.primary))
              else ...[
                ...fields,
                Text(
                  'A geração pode levar até 1 minuto.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
              if (error != null) ...[
                SizedBox(height: AppSpacing.sm),
                Text(error!, style: TextStyle(color: theme.colorScheme.error)),
              ],
              SizedBox(height: AppSpacing.md),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed:
                      loading ? null : (result != null ? onClose : onGenerate),
                  child: loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(result != null ? 'Fechar' : 'Gerar'),
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

class _DaysStepper extends StatelessWidget {
  final String label;
  final int value;
  final int min;
  final int max;
  final ValueChanged<int> onChanged;

  const _DaysStepper({
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(label)),
        IconButton(
          onPressed: value > min ? () => onChanged(value - 1) : null,
          icon: const Icon(Icons.remove_circle_outline),
        ),
        Text('$value', style: Theme.of(context).textTheme.titleMedium),
        IconButton(
          onPressed: value < max ? () => onChanged(value + 1) : null,
          icon: const Icon(Icons.add_circle_outline),
        ),
      ],
    );
  }
}
