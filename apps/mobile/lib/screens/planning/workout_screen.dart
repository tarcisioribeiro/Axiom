import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/exercise_catalog.dart';
import '../../models/workout_plan.dart';
import '../../models/workout_session.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/page_header.dart';
import '../../widgets/row_actions.dart';
import 'ai_generate_sheets.dart';
import 'exercise_catalog_form_sheet.dart';
import 'workout_plan_detail_screen.dart';
import 'workout_plan_form_sheet.dart';
import 'workout_session_form_sheet.dart';

class WorkoutScreen extends StatelessWidget {
  const WorkoutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.md,
                  0,
                ),
                child: AppPageHeader(
                  title: 'Treino',
                  icon: Icons.fitness_center_rounded,
                  color: context.semanticColors.warning,
                ),
              ),
              TabBar(
                tabs: const [
                  Tab(text: 'Sessões'),
                  Tab(text: 'Planos'),
                  Tab(text: 'Exercícios'),
                ],
              ),
              const Expanded(
                child: TabBarView(
                  children: [
                    _SessionsTab(),
                    _PlansTab(),
                    _ExercisesTab(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SessionsTab extends ConsumerWidget {
  const _SessionsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(workoutSessionsProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => showWorkoutSessionFormSheet(context),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(workoutSessionsProvider);
          await ref.read(workoutSessionsProvider.future);
        },
        child: sessionsAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, stackTrace) => Center(child: Text('Erro: $error')),
          data: (sessions) {
            final sorted = [...sessions]
              ..sort((a, b) => b.date.compareTo(a.date));
            return sorted.isEmpty
                ? const EmptyState(
                    icon: Icons.fitness_center_rounded,
                    title: 'Nenhum treino registrado',
                    message: 'Toque em + para registrar seu primeiro treino.',
                  )
                : ListView(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    children: sorted.map(_SessionTile.new).toList(),
                  );
          },
        ),
      ),
    );
  }
}

class _SessionTile extends StatelessWidget {
  final WorkoutSession session;

  const _SessionTile(this.session);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.smd),
      child: Row(
        children: [
          Icon(Icons.fitness_center_rounded,
              color: context.semanticColors.warning),
          SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.workoutDayName ?? 'Treino avulso',
                  style: theme.textTheme.titleSmall,
                ),
                Text(
                  AppFormatters.date(session.date),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                if (session.notes != null) Text(session.notes!),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PlansTab extends ConsumerWidget {
  const _PlansTab();

  Future<void> _delete(
      BuildContext context, WidgetRef ref, WorkoutPlan plan) async {
    try {
      await ref.read(workoutPlansServiceProvider).delete(plan.id);
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
    final plansAsync = ref.watch(workoutPlansProvider);

    return Scaffold(
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.small(
            heroTag: 'ai-workout',
            tooltip: 'Gerar com IA',
            onPressed: () => showAiWorkoutPlanSheet(context, ref),
            child: const Icon(Icons.auto_awesome_outlined),
          ),
          SizedBox(height: AppSpacing.sm),
          FloatingActionButton(
            heroTag: 'add-workout',
            onPressed: () => showWorkoutPlanFormSheet(context),
            child: const Icon(Icons.add),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(workoutPlansProvider);
          await ref.read(workoutPlansProvider.future);
        },
        child: plansAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, stackTrace) => Center(child: Text('Erro: $error')),
          data: (plans) => plans.isEmpty
              ? const EmptyState(
                  icon: Icons.event_note_outlined,
                  title: 'Nenhum plano cadastrado',
                )
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  children: plans
                      .map(
                        (plan) => _PlanTile(
                          plan: plan,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => WorkoutPlanDetailScreen(
                                planId: plan.id,
                                planName: plan.name,
                              ),
                            ),
                          ),
                          onEdit: () =>
                              showWorkoutPlanFormSheet(context, existing: plan),
                          onDelete: () => _delete(context, ref, plan),
                          deleteMessage:
                              'Excluir o plano "${plan.name}"? Essa ação não '
                              'pode ser desfeita.',
                        ),
                      )
                      .toList(),
                ),
        ),
      ),
    );
  }
}

class _PlanTile extends StatelessWidget {
  final WorkoutPlan plan;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final String deleteMessage;

  const _PlanTile({
    required this.plan,
    required this.onTap,
    required this.onEdit,
    required this.onDelete,
    required this.deleteMessage,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      onTap: onTap,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.smd,
        AppSpacing.smd,
        AppSpacing.sm,
        AppSpacing.smd,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(plan.name, style: theme.textTheme.titleSmall),
                    if (!plan.isActive) ...[
                      SizedBox(width: AppSpacing.xs),
                      Text(
                        '(inativo)',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
                if (plan.description != null) Text(plan.description!),
                Text(
                  '${plan.dayCount} dias · ${plan.exerciseCount} exercícios',
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
            deleteConfirmTitle: 'Excluir plano',
            deleteConfirmMessage: deleteMessage,
          ),
        ],
      ),
    );
  }
}

class _ExercisesTab extends ConsumerWidget {
  const _ExercisesTab();

  Future<void> _delete(
      BuildContext context, WidgetRef ref, ExerciseCatalog exercise) async {
    try {
      await ref.read(exerciseCatalogServiceProvider).delete(exercise.id);
      ref.invalidate(exerciseCatalogProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final exercisesAsync = ref.watch(exerciseCatalogProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => showExerciseCatalogFormSheet(context),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(exerciseCatalogProvider);
          await ref.read(exerciseCatalogProvider.future);
        },
        child: exercisesAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, stackTrace) => Center(child: Text('Erro: $error')),
          data: (exercises) => exercises.isEmpty
              ? const EmptyState(
                  icon: Icons.sports_gymnastics_rounded,
                  title: 'Nenhum exercício cadastrado',
                )
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  children: exercises
                      .map(
                        (exercise) => ListTile(
                          title: Text(exercise.name),
                          subtitle: exercise.muscleGroups == null
                              ? null
                              : Text(exercise.muscleGroups!),
                          trailing: RowActionsMenu(
                            onEdit: () => showExerciseCatalogFormSheet(
                              context,
                              existing: exercise,
                            ),
                            onDelete: () => _delete(context, ref, exercise),
                            deleteConfirmTitle: 'Excluir exercício',
                            deleteConfirmMessage:
                                'Excluir "${exercise.name}" do catálogo?',
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
      ),
    );
  }
}
