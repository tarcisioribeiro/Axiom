import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/food.dart';
import '../../models/hydration.dart';
import '../../models/meal_log.dart';
import '../../models/meal_type.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/feedback.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/motion.dart';
import '../../widgets/page_header.dart';
import '../../widgets/row_actions.dart';
import 'ai_generate_sheets.dart';
import 'food_form_sheet.dart';
import 'meal_log_form_sheet.dart';
import 'meal_type_detail_screen.dart';
import 'meal_type_form_sheet.dart';

DateTime _today() {
  final now = DateTime.now();
  return DateTime(now.year, now.month, now.day);
}

class NutritionScreen extends StatelessWidget {
  const NutritionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
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
                  title: 'Nutrição',
                  icon: Icons.restaurant_rounded,
                  color: context.palette.nutrition,
                ),
              ),
              TabBar(
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                tabs: const [
                  Tab(text: 'Hoje'),
                  Tab(text: 'Hidratação'),
                  Tab(text: 'Tipos de Refeição'),
                  Tab(text: 'Alimentos'),
                ],
              ),
              const Expanded(
                child: TabBarView(
                  children: [
                    _TodayTab(),
                    _HydrationTab(),
                    _MealTypesTab(),
                    _FoodsTab(),
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

class _TodayTab extends ConsumerWidget {
  const _TodayTab();

  Future<void> _delete(BuildContext context, WidgetRef ref, MealLog log) async {
    try {
      await ref.read(mealLogsServiceProvider).delete(log.id);
      if (context.mounted) showAppToast(context, 'Excluído com sucesso.');
      ref.invalidate(mealLogsProvider);
      // tarefas vinculadas à refeição são reabertas pelo backend
      ref.invalidate(taskInstancesForDateProvider(_today()));
    } on ApiException catch (e) {
      if (context.mounted) {
        showAppToast(context, e.message, kind: ToastKind.error);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = _today();
    final waterMl = (ref.watch(waterLogsForDateProvider(today)).valueOrNull ??
            const <WaterLog>[])
        .fold<int>(0, (acc, log) => acc + log.amountMl);
    final goalMl = ref.watch(hydrationGoalProvider).valueOrNull?.dailyTargetMl;
    final logsAsync = ref.watch(mealLogsProvider);
    final mealTypesAsync = ref.watch(mealTypesProvider);
    final summaryAsync = ref.watch(dailyCaloricSummaryProvider(today));
    final mealTypes = mealTypesAsync.valueOrNull ?? const <MealType>[];

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: mealTypes.isEmpty
            ? null
            : () => showMealLogFormSheet(context,
                mealTypes: mealTypes, date: today),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(mealLogsProvider);
          ref.invalidate(dailyCaloricSummaryProvider(today));
          ref.invalidate(waterLogsForDateProvider(today));
          ref.invalidate(hydrationGoalProvider);
          await ref.read(mealLogsProvider.future);
        },
        child: AsyncSwitcher(
            child: logsAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, stackTrace) => ErrorState(
              error: error, onRetry: () => ref.invalidate(mealLogsProvider)),
          data: (logs) {
            final todayLogs =
                logs.where((l) => _isSameDay(l.date, today)).toList();
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                summaryAsync.when(
                  loading: () => const SizedBox.shrink(),
                  error: (error, stackTrace) => const SizedBox.shrink(),
                  data: (summary) => summary.isEmpty
                      ? const SizedBox.shrink()
                      : _CaloricSummaryCard(
                          summary: summary,
                          waterMl: waterMl,
                          waterGoalMl: goalMl,
                        ),
                ),
                _WaterCard(date: today),
                if (todayLogs.isEmpty)
                  const EmptyState(
                    icon: Icons.restaurant_rounded,
                    title: 'Nenhuma refeição registrada hoje',
                  )
                else
                  ...todayLogs.map(
                    (log) => AppCard(
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.smd,
                        AppSpacing.smd,
                        AppSpacing.sm,
                        AppSpacing.smd,
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.restaurant_rounded,
                              color: context.semanticColors.success),
                          SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  log.mealTypeName ?? 'Refeição',
                                  style: Theme.of(context).textTheme.titleSmall,
                                ),
                                if (log.notes != null) Text(log.notes!),
                              ],
                            ),
                          ),
                          if (log.calories > 0)
                            Text(
                              '${log.calories.round()} kcal',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(
                                      color: context.semanticColors.warning),
                            ),
                          RowActionsMenu(
                            onDelete: () => _delete(context, ref, log),
                            deleteConfirmTitle: 'Excluir refeição',
                            deleteConfirmMessage:
                                'Remover "${log.mealTypeName ?? 'esta refeição'}" '
                                'do registro de hoje?',
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        )),
      ),
    );
  }

  bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}

/// Compact daily caloric balance from `daily-caloric-summary/`. TMB/TDEE need
/// the member's body metrics *and* birth date (age) — without them the backend
/// returns `bmr`/`tdee` as null, so we surface a hint instead of a raw dump.
class _CaloricSummaryCard extends StatelessWidget {
  const _CaloricSummaryCard({
    required this.summary,
    required this.waterMl,
    this.waterGoalMl,
  });

  final Map<String, dynamic> summary;
  final int waterMl;
  final int? waterGoalMl;

  int? _kcal(dynamic v) => v == null ? null : AppFormatters.toDouble(v).round();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final consumed = _kcal(summary['calories_consumed']) ?? 0;
    final burned = _kcal(summary['calories_burned_exercise']) ?? 0;
    final tdee = _kcal(summary['tdee']);
    final net = _kcal(summary['net_calories']);
    final hasMetrics = summary['has_body_metrics'] == true;

    final String? hint = !hasMetrics
        ? 'Cadastre suas medidas corporais (peso e altura) para calcular TMB e TDEE.'
        : tdee == null
            ? 'Informe sua data de nascimento no perfil de membro para calcular TMB e TDEE.'
            : null;

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Resumo calórico de hoje',
                    style: theme.textTheme.titleSmall),
                SizedBox(height: AppSpacing.sm),
                if (burned > 0)
                  _row(context, 'Gasto no treino', '-$burned kcal'),
                if (tdee != null) _row(context, 'Meta (TDEE)', '$tdee kcal'),
                if (net != null)
                  _row(
                    context,
                    'Saldo',
                    '${net > 0 ? '+' : ''}$net kcal',
                    color: net > 0
                        ? theme.colorScheme.error
                        : context.semanticColors.success,
                  ),
                if (hint != null) ...[
                  SizedBox(height: AppSpacing.sm),
                  Text(hint, style: theme.textTheme.bodySmall),
                ],
              ],
            ),
          ),
          SizedBox(width: AppSpacing.md),
          Column(
            children: [
              Text(
                '$consumed',
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: context.semanticColors.warning,
                ),
              ),
              Text('kcal', style: theme.textTheme.bodySmall),
            ],
          ),
          SizedBox(width: AppSpacing.md),
          Column(
            children: [
              Text(
                formatLiters(waterMl),
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: context.semanticColors.info,
                ),
              ),
              Text(
                waterGoalMl == null ? 'L' : '/ ${formatLiters(waterGoalMl!)} L',
                style: theme.textTheme.bodySmall,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value,
      {Color? color}) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: theme.textTheme.bodySmall),
          Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _MealTypesTab extends ConsumerWidget {
  const _MealTypesTab();

  Future<void> _delete(
      BuildContext context, WidgetRef ref, MealType mealType) async {
    try {
      await ref.read(mealTypesServiceProvider).delete(mealType.id);
      if (context.mounted) showAppToast(context, 'Excluído com sucesso.');
      ref.invalidate(mealTypesProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        showAppToast(context, e.message, kind: ToastKind.error);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mealTypesAsync = ref.watch(mealTypesProvider);

    return Scaffold(
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.small(
            heroTag: 'ai-menu',
            tooltip: 'Gerar cardápio com IA',
            onPressed: () => showAiMenuPlanSheet(context, ref),
            child: const Icon(Icons.auto_awesome_outlined),
          ),
          SizedBox(height: AppSpacing.sm),
          FloatingActionButton(
            heroTag: 'add-meal-type',
            onPressed: () => showMealTypeFormSheet(context),
            child: const Icon(Icons.add),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(mealTypesProvider);
          await ref.read(mealTypesProvider.future);
        },
        child: AsyncSwitcher(
            child: mealTypesAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, stackTrace) => ErrorState(
              error: error, onRetry: () => ref.invalidate(mealTypesProvider)),
          data: (mealTypes) => mealTypes.isEmpty
              ? const EmptyState(
                  icon: Icons.schedule_outlined,
                  title: 'Nenhum tipo de refeição cadastrado',
                )
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  children: mealTypes
                      .map(
                        (mealType) => ListTile(
                          title: Text(mealType.name),
                          subtitle: mealType.suggestedTime == null
                              ? null
                              : Text(mealType.suggestedTime!.substring(0, 5)),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => MealTypeDetailScreen(
                                mealTypeId: mealType.id,
                                mealTypeName: mealType.name,
                              ),
                            ),
                          ),
                          trailing: RowActionsMenu(
                            onEdit: () => showMealTypeFormSheet(
                              context,
                              existing: mealType,
                            ),
                            onDelete: () => _delete(context, ref, mealType),
                            deleteConfirmTitle: 'Excluir tipo de refeição',
                            deleteConfirmMessage: 'Excluir "${mealType.name}"?',
                          ),
                        ),
                      )
                      .toList(),
                ),
        )),
      ),
    );
  }
}

class _FoodsTab extends ConsumerWidget {
  const _FoodsTab();

  Future<void> _delete(BuildContext context, WidgetRef ref, Food food) async {
    try {
      await ref.read(foodsServiceProvider).delete(food.id);
      if (context.mounted) showAppToast(context, 'Excluído com sucesso.');
      ref.invalidate(foodsProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        showAppToast(context, e.message, kind: ToastKind.error);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final foodsAsync = ref.watch(foodsProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => showFoodFormSheet(context),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(foodsProvider);
          await ref.read(foodsProvider.future);
        },
        child: AsyncSwitcher(
            child: foodsAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, stackTrace) => ErrorState(
              error: error, onRetry: () => ref.invalidate(foodsProvider)),
          data: (foods) => foods.isEmpty
              ? const EmptyState(
                  icon: Icons.set_meal_outlined,
                  title: 'Nenhum alimento cadastrado',
                )
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  children: foods
                      .map(
                        (food) => ListTile(
                          title: Text(food.name),
                          subtitle: Text(
                            '${AppFormatters.number(food.caloriesPerServing)} kcal'
                            '${food.servingSize != null ? ' · ${AppFormatters.number(food.servingSize)} ${ChoiceLabels.of(ChoiceLabels.measurementUnits, food.servingUnit)}' : ''}',
                          ),
                          trailing: RowActionsMenu(
                            onEdit: () =>
                                showFoodFormSheet(context, existing: food),
                            onDelete: () => _delete(context, ref, food),
                            deleteConfirmTitle: 'Excluir alimento',
                            deleteConfirmMessage:
                                'Excluir "${food.name}" do catálogo?',
                          ),
                        ),
                      )
                      .toList(),
                ),
        )),
      ),
    );
  }
}

const _quickAmountsMl = [200, 250, 500];

/// Registro de água do dia: progresso da meta, atalhos e lista.
class _WaterCard extends ConsumerStatefulWidget {
  const _WaterCard({required this.date});

  final DateTime date;

  @override
  ConsumerState<_WaterCard> createState() => _WaterCardState();
}

class _WaterCardState extends ConsumerState<_WaterCard> {
  final _customController = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _customController.dispose();
    super.dispose();
  }

  void _invalidate() {
    ref.invalidate(waterLogsForDateProvider(widget.date));
    // ocorrências de tarefas vinculadas à meta são concluídas pelo backend
    ref.invalidate(taskInstancesForDateProvider(widget.date));
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    setState(() => _busy = true);
    try {
      await action();
      _invalidate();
      if (mounted) showAppToast(context, success);
    } on ApiException catch (e) {
      if (mounted) showAppToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _add(int ml) {
    final now = TimeOfDay.now();
    final time =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    _run(
      () => ref
          .read(hydrationServiceProvider)
          .addWater(widget.date, ml, time: time),
      'Água registrada.',
    );
    _customController.clear();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final water = context.semanticColors.info;
    final logs = ref.watch(waterLogsForDateProvider(widget.date)).valueOrNull ??
        const <WaterLog>[];
    final goalMl = ref.watch(hydrationGoalProvider).valueOrNull?.dailyTargetMl;
    final total = logs.fold<int>(0, (acc, log) => acc + log.amountMl);
    final custom = int.tryParse(_customController.text);

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.water_drop_rounded, color: water),
              SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text('Água do dia', style: theme.textTheme.titleSmall),
              ),
              Text(
                goalMl == null
                    ? '${formatLiters(total)} L'
                    : '${formatLiters(total)} / ${formatLiters(goalMl)} L',
                style: theme.textTheme.titleSmall?.copyWith(color: water),
              ),
            ],
          ),
          SizedBox(height: AppSpacing.sm),
          if (goalMl != null)
            LinearProgressIndicator(
              value: (total / goalMl).clamp(0, 1).toDouble(),
              color: water,
              backgroundColor: water.withValues(alpha: 0.15),
            )
          else
            Text('Defina sua meta na aba Hidratação.',
                style: theme.textTheme.bodySmall),
          SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (final ml in _quickAmountsMl)
                ActionChip(
                  avatar: const Icon(Icons.add, size: 16),
                  label: Text('$ml ml'),
                  onPressed: _busy ? null : () => _add(ml),
                ),
              SizedBox(
                width: 96,
                child: TextField(
                  controller: _customController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    hintText: 'ml',
                    isDense: true,
                  ),
                  onChanged: (_) => setState(() {}),
                  onSubmitted: (_) {
                    if (custom != null && custom > 0) _add(custom);
                  },
                ),
              ),
              IconButton(
                tooltip: 'Adicionar',
                icon: const Icon(Icons.add_circle_outline),
                onPressed: _busy || custom == null || custom <= 0
                    ? null
                    : () => _add(custom),
              ),
            ],
          ),
          for (final log in logs)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: Text(log.time?.substring(0, 5) ?? '--:--'),
              title: Text('${log.amountMl} ml'),
              subtitle: log.fromTask ? const Text('via tarefa') : null,
              trailing: IconButton(
                tooltip: 'Excluir',
                icon: const Icon(Icons.delete_outline),
                onPressed: _busy
                    ? null
                    : () => _run(
                          () => ref
                              .read(hydrationServiceProvider)
                              .deleteWater(log.id),
                          'Registro removido.',
                        ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Meta de hidratação atual + sugestão (peso + treinos dos planos ativos).
class _HydrationTab extends ConsumerStatefulWidget {
  const _HydrationTab();

  @override
  ConsumerState<_HydrationTab> createState() => _HydrationTabState();
}

class _HydrationTabState extends ConsumerState<_HydrationTab> {
  final _litersController = TextEditingController();
  bool _initialized = false;
  bool _saving = false;

  @override
  void dispose() {
    _litersController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final liters = double.tryParse(_litersController.text.replaceAll(',', '.'));
    if (liters == null || liters <= 0) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(hydrationServiceProvider)
          .saveGoal((liters * 1000).round());
      ref.invalidate(hydrationGoalProvider);
      if (mounted) showAppToast(context, 'Meta de hidratação salva.');
    } on ApiException catch (e) {
      final errors = e.errors;
      final msg = errors is Map && errors['daily_target_ml'] is List
          ? (errors['daily_target_ml'] as List).first.toString()
          : e.message;
      if (mounted) showAppToast(context, msg, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final water = context.semanticColors.info;
    final goalAsync = ref.watch(hydrationGoalProvider);
    final suggestion = ref.watch(hydrationSuggestionProvider).valueOrNull;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(hydrationGoalProvider);
        ref.invalidate(hydrationSuggestionProvider);
        await ref.read(hydrationGoalProvider.future);
      },
      child: goalAsync.when(
        loading: () => const LoadingState(variant: LoadingVariant.list),
        error: (error, stackTrace) => ErrorState(
            error: error, onRetry: () => ref.invalidate(hydrationGoalProvider)),
        data: (goal) {
          if (!_initialized) {
            _initialized = true;
            if (goal.dailyTargetMl != null) {
              _litersController.text = formatLiters(goal.dailyTargetMl!);
            }
          }
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              AppCard(
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.water_drop_rounded, color: water),
                        SizedBox(width: AppSpacing.sm),
                        Text('Meta diária de hidratação',
                            style: theme.textTheme.titleSmall),
                      ],
                    ),
                    SizedBox(height: AppSpacing.xs),
                    Text(
                      goal.dailyTargetMl == null
                          ? 'Nenhuma meta definida'
                          : 'Meta atual: ${formatLiters(goal.dailyTargetMl!)} L por dia',
                      style: theme.textTheme.bodySmall,
                    ),
                    SizedBox(height: AppSpacing.sm),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _litersController,
                            keyboardType: const TextInputType.numberWithOptions(
                                decimal: true),
                            decoration: const InputDecoration(
                              labelText: 'Meta (litros por dia)',
                            ),
                          ),
                        ),
                        SizedBox(width: AppSpacing.sm),
                        FilledButton(
                          onPressed: _saving ? null : _save,
                          child: const Text('Salvar'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              AppCard(
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Sugestão com base no seu corpo e treinos',
                        style: theme.textTheme.titleSmall),
                    SizedBox(height: AppSpacing.sm),
                    if (suggestion?.suggestedMl == null)
                      Text(
                        'Cadastre seu peso em Medidas Corporais para receber '
                        'uma sugestão.',
                        style: theme.textTheme.bodySmall,
                      )
                    else ...[
                      Text(
                        '${formatLiters(suggestion!.suggestedMl!)} L',
                        style: theme.textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: water,
                        ),
                      ),
                      Text(
                        '${AppFormatters.number(suggestion.weightKg)} kg × '
                        '${suggestion.mlPerKg} ml = ${suggestion.baseMl} ml',
                        style: theme.textTheme.bodySmall,
                      ),
                      Text(
                        '+ ${suggestion.exerciseMl} ml de treino '
                        '(${suggestion.trainingDaysPerWeek} dias, '
                        '${suggestion.trainingMinutesPerWeek} min por semana)',
                        style: theme.textTheme.bodySmall,
                      ),
                      SizedBox(height: AppSpacing.sm),
                      OutlinedButton(
                        onPressed: () => setState(() => _litersController.text =
                            formatLiters(suggestion.suggestedMl!)),
                        child: const Text('Usar sugestão'),
                      ),
                    ],
                  ],
                ),
              ),
              Text(
                'Tarefas da categoria Nutrição vinculadas à meta são concluídas '
                'conforme você registra água — e concluir a tarefa registra a '
                'água.',
                style: theme.textTheme.bodySmall,
              ),
            ],
          );
        },
      ),
    );
  }
}
