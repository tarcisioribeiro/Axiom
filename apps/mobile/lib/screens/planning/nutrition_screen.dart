import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/food.dart';
import '../../models/meal_log.dart';
import '../../models/meal_type.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/page_header.dart';
import 'food_form_sheet.dart';
import 'meal_log_form_sheet.dart';
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
                  title: 'Nutrição',
                  icon: Icons.restaurant_rounded,
                  color: context.semanticColors.success,
                ),
              ),
              TabBar(
                tabs: const [
                  Tab(text: 'Hoje'),
                  Tab(text: 'Tipos de Refeição'),
                  Tab(text: 'Alimentos'),
                ],
                labelColor: Theme.of(context).colorScheme.primary,
              ),
              const Expanded(
                child: TabBarView(
                  children: [_TodayTab(), _MealTypesTab(), _FoodsTab()],
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
      ref.invalidate(mealLogsProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = _today();
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
          await ref.read(mealLogsProvider.future);
        },
        child: logsAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, stackTrace) => Center(child: Text('Erro: $error')),
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
                      : Container(
                          margin: EdgeInsets.only(bottom: AppSpacing.md),
                          padding: const EdgeInsets.all(AppSpacing.md),
                          decoration: BoxDecoration(
                            color: Theme.of(context).cardColor,
                            borderRadius: AppRadius.lgRadius,
                            border: Border.all(
                              color: Theme.of(context)
                                  .dividerColor
                                  .withValues(alpha: 0.4),
                            ),
                          ),
                          child: Text(
                            summary.entries
                                .map((e) => '${e.key}: ${e.value}')
                                .join(' · '),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                ),
                if (todayLogs.isEmpty)
                  const EmptyState(
                    icon: Icons.restaurant_rounded,
                    title: 'Nenhuma refeição registrada hoje',
                  )
                else
                  ...todayLogs.map(
                    (log) => Container(
                      margin: EdgeInsets.only(bottom: AppSpacing.sm),
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: Theme.of(context).cardColor,
                        borderRadius: AppRadius.mdRadius,
                        border: Border.all(
                          color: Theme.of(context)
                              .dividerColor
                              .withValues(alpha: 0.4),
                        ),
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
                          IconButton(
                            icon: const Icon(Icons.delete_outline, size: 18),
                            onPressed: () => _delete(context, ref, log),
                          ),
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

  bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}

class _MealTypesTab extends ConsumerWidget {
  const _MealTypesTab();

  Future<void> _delete(
      BuildContext context, WidgetRef ref, MealType mealType) async {
    try {
      await ref.read(mealTypesServiceProvider).delete(mealType.id);
      ref.invalidate(mealTypesProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mealTypesAsync = ref.watch(mealTypesProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => showMealTypeFormSheet(context),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(mealTypesProvider);
          await ref.read(mealTypesProvider.future);
        },
        child: mealTypesAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, stackTrace) => Center(child: Text('Erro: $error')),
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
                              : Text(mealType.suggestedTime!),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.edit_outlined, size: 18),
                                onPressed: () => showMealTypeFormSheet(
                                  context,
                                  existing: mealType,
                                ),
                              ),
                              IconButton(
                                icon:
                                    const Icon(Icons.delete_outline, size: 18),
                                onPressed: () =>
                                    _delete(context, ref, mealType),
                              ),
                            ],
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

class _FoodsTab extends ConsumerWidget {
  const _FoodsTab();

  Future<void> _delete(BuildContext context, WidgetRef ref, Food food) async {
    try {
      await ref.read(foodsServiceProvider).delete(food.id);
      ref.invalidate(foodsProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
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
        child: foodsAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, stackTrace) => Center(child: Text('Erro: $error')),
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
                            '${food.caloriesPerServing.toStringAsFixed(0)} kcal'
                            '${food.servingSize != null ? ' · ${food.servingSize}${food.servingUnit ?? ''}' : ''}',
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.edit_outlined, size: 18),
                                onPressed: () =>
                                    showFoodFormSheet(context, existing: food),
                              ),
                              IconButton(
                                icon:
                                    const Icon(Icons.delete_outline, size: 18),
                                onPressed: () => _delete(context, ref, food),
                              ),
                            ],
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
