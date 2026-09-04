import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/goal.dart';
import '../../models/routine_task.dart';
import '../../models/task_instance.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../widgets/accent_card.dart';
import '../../widgets/app_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/habit_heatmap.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/page_header.dart';
import '../../widgets/pomodoro_sheet.dart';
import '../../widgets/row_actions.dart';
import 'goal_form_sheet.dart';
import 'routine_task_form_sheet.dart';

DateTime _today() {
  final now = DateTime.now();
  return DateTime(now.year, now.month, now.day);
}

class TasksGoalsScreen extends StatelessWidget {
  const TasksGoalsScreen({super.key});

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
                  title: 'Tarefas & Metas',
                  icon: Icons.checklist_rounded,
                  color: context.semanticColors.info,
                  trailing: IconButton(
                    tooltip: 'Pomodoro',
                    icon: const Icon(Icons.timer_outlined),
                    onPressed: () => showPomodoroSheet(context),
                  ),
                ),
              ),
              TabBar(
                tabs: const [
                  Tab(text: 'Checklist'),
                  Tab(text: 'Rotinas'),
                  Tab(text: 'Metas'),
                ],
              ),
              const Expanded(
                child: TabBarView(
                  children: [_ChecklistTab(), _RoutinesTab(), _GoalsTab()],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChecklistTab extends ConsumerStatefulWidget {
  const _ChecklistTab();

  @override
  ConsumerState<_ChecklistTab> createState() => _ChecklistTabState();
}

class _ChecklistTabState extends ConsumerState<_ChecklistTab> {
  /// Ordered kanban columns — mirrors the web board's todo/doing/done.
  static const _boardColumns = ['pending', 'in_progress', 'completed'];
  bool _boardView = false;

  Future<void> _cycleStatus(WidgetRef ref, TaskInstance instance) async {
    const order = ['pending', 'in_progress', 'completed'];
    final currentIndex = order.indexOf(instance.status);
    final next = order[(currentIndex + 1) % order.length];
    await _setStatus(ref, instance, next);
  }

  Future<void> _setStatus(
      WidgetRef ref, TaskInstance instance, String status) async {
    await ref
        .read(taskInstancesServiceProvider)
        .updateStatus(instance.id, status);
    ref.invalidate(taskInstancesForDateProvider(_today()));
  }

  Future<void> _pickStatus(
      BuildContext context, WidgetRef ref, TaskInstance instance) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: ChoiceLabels.taskInstanceStatuses.entries
              .map((e) => ListTile(
                    title: Text(e.value),
                    trailing: instance.status == e.key
                        ? const Icon(Icons.check)
                        : null,
                    onTap: () => Navigator.of(context).pop(e.key),
                  ))
              .toList(),
        ),
      ),
    );
    if (picked != null && picked != instance.status) {
      await _setStatus(ref, instance, picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    final today = _today();
    final instancesAsync = ref.watch(taskInstancesForDateProvider(today));

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(taskInstancesForDateProvider(today));
        await ref.read(taskInstancesForDateProvider(today).future);
      },
      child: instancesAsync.when(
        loading: () => const LoadingState(variant: LoadingVariant.list),
        error: (error, stackTrace) => Center(child: Text('Erro: $error')),
        data: (data) => ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${data.completed} de ${data.total} concluídas hoje',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                SegmentedButton<bool>(
                  showSelectedIcon: false,
                  style:
                      const ButtonStyle(visualDensity: VisualDensity.compact),
                  segments: const [
                    ButtonSegment(
                        value: false, icon: Icon(Icons.view_list_rounded)),
                    ButtonSegment(
                        value: true, icon: Icon(Icons.view_kanban_outlined)),
                  ],
                  selected: {_boardView},
                  onSelectionChanged: (s) =>
                      setState(() => _boardView = s.first),
                ),
              ],
            ),
            SizedBox(height: AppSpacing.sm),
            if (data.instances.isEmpty)
              const EmptyState(
                icon: Icons.checklist_rounded,
                title: 'Nenhuma tarefa para hoje',
              )
            else if (_boardView)
              ..._buildBoard(context, ref, data.instances)
            else
              ...data.instances.map(
                (instance) => _InstanceTile(
                  instance: instance,
                  onTap: () => _cycleStatus(ref, instance),
                  onLongPress: () => _pickStatus(context, ref, instance),
                ),
              ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildBoard(
      BuildContext context, WidgetRef ref, List<TaskInstance> instances) {
    final theme = Theme.of(context);
    final widgets = <Widget>[];
    for (final col in _boardColumns) {
      final inCol = instances.where((i) => i.status == col).toList();
      widgets.add(Padding(
        padding:
            const EdgeInsets.only(top: AppSpacing.sm, bottom: AppSpacing.xs),
        child: Text(
          '${ChoiceLabels.of(ChoiceLabels.taskInstanceStatuses, col)} '
          '(${inCol.length})',
          style: theme.textTheme.labelLarge,
        ),
      ));
      if (inCol.isEmpty) {
        widgets.add(Text('—',
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant)));
      } else {
        widgets.addAll(inCol.map((instance) => _InstanceTile(
              instance: instance,
              onTap: () => _cycleStatus(ref, instance),
              onLongPress: () => _pickStatus(context, ref, instance),
            )));
      }
    }
    // Anything not in the 3 canonical columns (skipped / cancelled).
    final other =
        instances.where((i) => !_boardColumns.contains(i.status)).toList();
    if (other.isNotEmpty) {
      widgets.add(Padding(
        padding:
            const EdgeInsets.only(top: AppSpacing.sm, bottom: AppSpacing.xs),
        child:
            Text('Outros (${other.length})', style: theme.textTheme.labelLarge),
      ));
      widgets.addAll(other.map((instance) => _InstanceTile(
            instance: instance,
            onTap: () => _cycleStatus(ref, instance),
            onLongPress: () => _pickStatus(context, ref, instance),
          )));
    }
    return widgets;
  }
}

class _InstanceTile extends StatelessWidget {
  final TaskInstance instance;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  const _InstanceTile({
    required this.instance,
    required this.onTap,
    required this.onLongPress,
  });

  Color _statusColor(BuildContext context) {
    switch (instance.status) {
      case 'completed':
        return context.semanticColors.success;
      case 'in_progress':
        return context.semanticColors.info;
      default:
        return instance.isOverdue
            ? Theme.of(context).colorScheme.error
            : context.semanticColors.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = _statusColor(context);
    return InkWell(
      borderRadius: AppRadius.mdRadius,
      onTap: onTap,
      onLongPress: onLongPress,
      child: AccentCard(
        accentColor: color,
        child: Row(
          children: [
            Icon(
              instance.isCompleted
                  ? Icons.check_circle
                  : Icons.radio_button_unchecked,
              color: color,
            ),
            SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(instance.taskName, style: theme.textTheme.titleSmall),
                  Text(
                    ChoiceLabels.of(
                        ChoiceLabels.taskCategories, instance.category),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              ChoiceLabels.of(
                  ChoiceLabels.taskInstanceStatuses, instance.status),
              style: theme.textTheme.labelSmall?.copyWith(color: color),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoutinesTab extends ConsumerWidget {
  const _RoutinesTab();

  Future<void> _delete(
      BuildContext context, WidgetRef ref, RoutineTask task) async {
    try {
      await ref.read(routineTasksServiceProvider).delete(task.id);
      ref.invalidate(routineTasksProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasksAsync = ref.watch(routineTasksProvider);
    final heatmapAsync = ref.watch(habitHeatmapProvider(DateTime.now().year));

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => showRoutineTaskFormSheet(context),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(routineTasksProvider);
          ref.invalidate(habitHeatmapProvider(DateTime.now().year));
          await ref.read(routineTasksProvider.future);
        },
        child: tasksAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, stackTrace) => Center(child: Text('Erro: $error')),
          data: (tasks) => ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              heatmapAsync.maybeWhen(
                data: (h) => Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.md),
                  child: HabitHeatmapView(heatmap: h),
                ),
                orElse: () => const SizedBox.shrink(),
              ),
              if (tasks.isEmpty)
                const EmptyState(
                  icon: Icons.repeat_rounded,
                  title: 'Nenhuma rotina cadastrada',
                )
              else
                ...tasks.map(
                  (task) => _RoutineTile(
                    task: task,
                    onEdit: () =>
                        showRoutineTaskFormSheet(context, existing: task),
                    onDelete: () => _delete(context, ref, task),
                    deleteMessage:
                        'Excluir a rotina "${task.name}"? As tarefas já '
                        'geradas por ela não são removidas.',
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoutineTile extends StatelessWidget {
  final RoutineTask task;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final String deleteMessage;

  const _RoutineTile({
    required this.task,
    required this.onEdit,
    required this.onDelete,
    required this.deleteMessage,
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
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(task.name, style: theme.textTheme.titleSmall),
                Text(
                  '${ChoiceLabels.of(ChoiceLabels.taskCategories, task.category)} · '
                  '${ChoiceLabels.of(ChoiceLabels.periodicities, task.periodicity)}'
                  '${task.periodicity == "weekly" && task.weekday != null ? ' (${ChoiceLabels.weekdays[task.weekday] ?? ""})' : ''}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                Text(
                  'Conclusão: ${task.completionRate.round()}%',
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          RowActionsMenu(
            onEdit: onEdit,
            onDelete: onDelete,
            deleteConfirmTitle: 'Excluir rotina',
            deleteConfirmMessage: deleteMessage,
          ),
        ],
      ),
    );
  }
}

class _GoalsTab extends ConsumerWidget {
  const _GoalsTab();

  Future<void> _delete(BuildContext context, WidgetRef ref, Goal goal) async {
    try {
      await ref.read(goalsServiceProvider).delete(goal.id);
      ref.invalidate(goalsProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goalsAsync = ref.watch(goalsProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => showGoalFormSheet(context),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(goalsProvider);
          await ref.read(goalsProvider.future);
        },
        child: goalsAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, stackTrace) => Center(child: Text('Erro: $error')),
          data: (goals) => goals.isEmpty
              ? const EmptyState(
                  icon: Icons.flag_outlined,
                  title: 'Nenhuma meta cadastrada',
                )
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  children: goals
                      .map(
                        (goal) => _GoalTile(
                          goal: goal,
                          onEdit: () =>
                              showGoalFormSheet(context, existing: goal),
                          onDelete: () => _delete(context, ref, goal),
                          deleteMessage:
                              'Excluir a meta "${goal.title}"? Essa ação não '
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

class _GoalTile extends StatelessWidget {
  final Goal goal;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final String deleteMessage;

  const _GoalTile({
    required this.goal,
    required this.onEdit,
    required this.onDelete,
    required this.deleteMessage,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
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
                child: Text(goal.title, style: theme.textTheme.titleSmall),
              ),
              RowActionsMenu(
                onEdit: onEdit,
                onDelete: onDelete,
                deleteConfirmTitle: 'Excluir meta',
                deleteConfirmMessage: deleteMessage,
              ),
            ],
          ),
          Text(
            '${ChoiceLabels.of(ChoiceLabels.goalTypes, goal.goalType)} · '
            '${ChoiceLabels.of(ChoiceLabels.goalStatuses, goal.status)}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          SizedBox(height: AppSpacing.xs),
          ClipRRect(
            borderRadius: AppRadius.smRadius,
            child: LinearProgressIndicator(
              value: (goal.progressPercentage / 100).clamp(0, 1),
              minHeight: 6,
            ),
          ),
          SizedBox(height: AppSpacing.xs),
          Text(
            '${goal.currentValue.toStringAsFixed(0)} / ${goal.targetValue.toStringAsFixed(0)}',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
