import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/wellness.dart';
import '../../providers/planning_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/stat_card.dart';

/// "Wellness Center" — check-ins emocionais, modo crise, biblioteca de
/// intervenções e relatório semanal. Mirror da página web `EmotionalWellness`.
class WellnessScreen extends StatelessWidget {
  const WellnessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 5,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Bem-estar'),
          bottom: const TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(text: 'Painel'),
              Tab(text: 'Check-in'),
              Tab(text: 'Crise'),
              Tab(text: 'Biblioteca'),
              Tab(text: 'Relatório'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _DashboardTab(),
            _CheckinTab(),
            _CrisisTab(),
            _LibraryTab(),
            _ReportTab(),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

class _DashboardTab extends ConsumerWidget {
  const _DashboardTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(wellnessDashboardProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(wellnessDashboardProvider);
        await ref.read(wellnessDashboardProvider.future);
      },
      child: async.when(
        loading: () => const LoadingState(variant: LoadingVariant.stats),
        error: (e, _) => Center(child: Text('Erro: $e')),
        data: (d) => ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            StatCard(
              title: 'Autoestima (Rosenberg)',
              value:
                  d.selfEsteemScore == null ? '—' : '${d.selfEsteemScore}/30',
              description: d.selfEsteemWeekAvg == null
                  ? null
                  : 'média 7d ${d.selfEsteemWeekAvg}',
              icon: Icons.self_improvement_rounded,
              accent: StatAccent.primary,
              prominent: true,
            ),
            SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: StatCard(
                    title: 'Check-ins 7d',
                    value: '${d.checkinsThisWeek}',
                    icon: Icons.mood_rounded,
                    accent: StatAccent.info,
                  ),
                ),
                SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: StatCard(
                    title: 'Impulsos 7d',
                    value:
                        '${d.impulsesResolvedThisWeek}/${d.impulsesThisWeek}',
                    description: 'superados',
                    icon: Icons.shield_moon_rounded,
                    accent: StatAccent.warning,
                  ),
                ),
              ],
            ),
            SizedBox(height: AppSpacing.md),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Médias emocionais (7 dias)',
                      style: Theme.of(context).textTheme.titleSmall),
                  SizedBox(height: AppSpacing.sm),
                  _bar(context, 'Solidão', d.avgLoneliness),
                  _bar(context, 'Ansiedade', d.avgAnxiety),
                  _bar(context, 'Motivação', d.avgMotivation),
                  _bar(context, 'Energia', d.avgEnergy),
                ],
              ),
            ),
            SizedBox(height: AppSpacing.md),
            Text(
              'Intervenções concluídas nesta semana: ${d.interventionsThisWeek}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  Widget _bar(BuildContext context, String label, double? value) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        children: [
          SizedBox(
              width: 80, child: Text(label, style: theme.textTheme.bodySmall)),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: (value ?? 0) / 10,
                minHeight: 6,
                backgroundColor: theme.colorScheme.surfaceContainerHighest,
              ),
            ),
          ),
          SizedBox(width: AppSpacing.sm),
          Text(value?.toStringAsFixed(1) ?? '—',
              style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

class _CheckinTab extends ConsumerWidget {
  const _CheckinTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(emotionalCheckinsProvider);
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCheckinForm(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Check-in'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(emotionalCheckinsProvider);
          await ref.read(emotionalCheckinsProvider.future);
        },
        child: async.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (e, _) => Center(child: Text('Erro: $e')),
          data: (list) => list.isEmpty
              ? const EmptyState(
                  icon: Icons.mood_rounded, title: 'Nenhum check-in ainda')
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  children: list
                      .map((c) => AppCard(
                            margin:
                                const EdgeInsets.only(bottom: AppSpacing.sm),
                            padding: const EdgeInsets.all(AppSpacing.smd),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(AppFormatters.date(c.checkedAt),
                                    style:
                                        Theme.of(context).textTheme.titleSmall),
                                SizedBox(height: AppSpacing.xs),
                                Text(
                                  'Solidão ${c.loneliness} · Ansiedade ${c.anxiety} · '
                                  'Tristeza ${c.sadness} · Motivação ${c.motivation} · '
                                  'Energia ${c.energy}',
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurfaceVariant,
                                      ),
                                ),
                                if (c.whatHappened?.isNotEmpty ?? false) ...[
                                  SizedBox(height: AppSpacing.xs),
                                  Text(c.whatHappened!,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall),
                                ],
                              ],
                            ),
                          ))
                      .toList(),
                ),
        ),
      ),
    );
  }
}

void _showCheckinForm(BuildContext context, WidgetRef ref) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const _CheckinFormSheet(),
  );
}

class _CheckinFormSheet extends ConsumerStatefulWidget {
  const _CheckinFormSheet();

  @override
  ConsumerState<_CheckinFormSheet> createState() => _CheckinFormSheetState();
}

class _CheckinFormSheetState extends ConsumerState<_CheckinFormSheet> {
  final _scores = <String, int>{
    'loneliness': 0,
    'neediness': 0,
    'anxiety': 0,
    'sadness': 0,
    'motivation': 5,
    'energy': 5,
  };
  final _whatHappened = TextEditingController();
  final _thoughts = TextEditingController();
  bool _saving = false;
  String? _error;

  static const _labels = {
    'loneliness': 'Solidão',
    'neediness': 'Carência',
    'anxiety': 'Ansiedade',
    'sadness': 'Tristeza',
    'motivation': 'Motivação',
    'energy': 'Energia',
  };

  @override
  void dispose() {
    _whatHappened.dispose();
    _thoughts.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(wellnessServiceProvider).createCheckin(EmotionalCheckin(
            id: 0,
            checkedAt: DateTime.now(),
            loneliness: _scores['loneliness']!,
            neediness: _scores['neediness']!,
            anxiety: _scores['anxiety']!,
            sadness: _scores['sadness']!,
            motivation: _scores['motivation']!,
            energy: _scores['energy']!,
            whatHappened: _whatHappened.text.trim(),
            occupyingThoughts: _thoughts.text.trim(),
          ));
      ref.invalidate(emotionalCheckinsProvider);
      ref.invalidate(wellnessDashboardProvider);
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          bottom: AppSpacing.md + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Check-in emocional',
                style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: AppSpacing.sm),
            ..._labels.entries.map((e) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${e.value}: ${_scores[e.key]}',
                        style: Theme.of(context).textTheme.bodySmall),
                    Slider(
                      value: _scores[e.key]!.toDouble(),
                      min: 0,
                      max: 10,
                      divisions: 10,
                      label: '${_scores[e.key]}',
                      onChanged: (v) =>
                          setState(() => _scores[e.key] = v.round()),
                    ),
                  ],
                )),
            TextField(
              controller: _whatHappened,
              decoration:
                  const InputDecoration(labelText: 'O que aconteceu hoje?'),
              maxLines: 2,
            ),
            SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _thoughts,
              decoration: const InputDecoration(
                  labelText: 'O que está ocupando seus pensamentos?'),
              maxLines: 2,
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
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2))
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
// Crise
// ---------------------------------------------------------------------------

class _CrisisTab extends ConsumerWidget {
  const _CrisisTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(crisisLogsProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(crisisLogsProvider);
        await ref.read(crisisLogsProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          AppCard(
            accentColor: Theme.of(context).colorScheme.error,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Modo crise',
                    style: Theme.of(context).textTheme.titleSmall),
                SizedBox(height: AppSpacing.xs),
                Text(
                  'Sentindo um impulso difícil? Registre o que está sentindo '
                  'e receba um plano de ação imediato.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                SizedBox(height: AppSpacing.sm),
                FilledButton.icon(
                  onPressed: () => _showCrisisForm(context, ref),
                  icon: const Icon(Icons.emergency_outlined),
                  label: const Text('Preciso de ajuda agora'),
                ),
              ],
            ),
          ),
          SizedBox(height: AppSpacing.md),
          async.when(
            loading: () =>
                const LoadingState(variant: LoadingVariant.list, itemCount: 2),
            error: (e, _) => Text('Erro: $e'),
            data: (logs) => logs.isEmpty
                ? const SizedBox.shrink()
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Registros anteriores',
                          style: Theme.of(context).textTheme.titleSmall),
                      SizedBox(height: AppSpacing.sm),
                      ...logs.map((l) => _CrisisTile(log: l)),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _CrisisTile extends ConsumerWidget {
  final CrisisImpulseLog log;

  const _CrisisTile({required this.log});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    CrisisAiResponse? ai;
    if (log.aiResponse != null && log.aiResponse!.isNotEmpty) {
      try {
        ai = CrisisAiResponse.tryParse(jsonDecode(log.aiResponse!));
      } catch (_) {}
    }
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.smd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${log.emotionalStateDisplay ?? ChoiceLabels.of(ChoiceLabels.emotionalStates, log.emotionalState)}'
                  ' → ${log.impulseTypeDisplay ?? ChoiceLabels.of(ChoiceLabels.impulseTypes, log.impulseType)}',
                  style: theme.textTheme.titleSmall,
                ),
              ),
              if (log.resolved)
                Icon(Icons.check_circle,
                    color: context.semanticColors.success, size: 18)
              else
                TextButton(
                  onPressed: () async {
                    await ref
                        .read(wellnessServiceProvider)
                        .resolveCrisis(log.id);
                    ref.invalidate(crisisLogsProvider);
                    ref.invalidate(wellnessDashboardProvider);
                  },
                  child: const Text('Superei'),
                ),
            ],
          ),
          Text(AppFormatters.dateTime(log.loggedAt),
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              )),
          if (ai != null) ...[
            SizedBox(height: AppSpacing.sm),
            _CrisisAiView(ai: ai),
          ],
        ],
      ),
    );
  }
}

class _CrisisAiView extends StatelessWidget {
  final CrisisAiResponse ai;

  const _CrisisAiView({required this.ai});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (ai.validation.isNotEmpty)
          Text(ai.validation, style: theme.textTheme.bodySmall),
        if (ai.explanation.isNotEmpty) ...[
          SizedBox(height: AppSpacing.xs),
          Text(ai.explanation,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              )),
        ],
        ...ai.actionPlan.entries.map((e) => Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(e.key,
                      style: theme.textTheme.labelMedium
                          ?.copyWith(fontWeight: FontWeight.w700)),
                  ...e.value.map(
                      (a) => Text('• $a', style: theme.textTheme.bodySmall)),
                ],
              ),
            )),
        if (ai.affirmation.isNotEmpty) ...[
          SizedBox(height: AppSpacing.xs),
          Text(ai.affirmation,
              style: theme.textTheme.bodySmall
                  ?.copyWith(fontStyle: FontStyle.italic)),
        ],
      ],
    );
  }
}

void _showCrisisForm(BuildContext context, WidgetRef ref) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const _CrisisFormSheet(),
  );
}

class _CrisisFormSheet extends ConsumerStatefulWidget {
  const _CrisisFormSheet();

  @override
  ConsumerState<_CrisisFormSheet> createState() => _CrisisFormSheetState();
}

class _CrisisFormSheetState extends ConsumerState<_CrisisFormSheet> {
  String _emotionalState = 'anxiety';
  String _impulseType = 'social_media';
  final _emotionalOther = TextEditingController();
  final _impulseOther = TextEditingController();
  bool _loading = false;
  String? _error;
  CrisisAiResponse? _result;

  @override
  void dispose() {
    _emotionalOther.dispose();
    _impulseOther.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final log = await ref.read(wellnessServiceProvider).createCrisisLog(
            emotionalState: _emotionalState,
            emotionalStateOther: _emotionalOther.text.trim(),
            impulseType: _impulseType,
            impulseTypeOther: _impulseOther.text.trim(),
          );
      ref.invalidate(crisisLogsProvider);
      ref.invalidate(wellnessDashboardProvider);
      CrisisAiResponse? ai;
      if (log.aiResponse != null && log.aiResponse!.isNotEmpty) {
        try {
          ai = CrisisAiResponse.tryParse(jsonDecode(log.aiResponse!));
        } catch (_) {}
      }
      setState(() => _result = ai);
      if (ai == null && mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          bottom: AppSpacing.md + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Modo crise', style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: AppSpacing.md),
            if (_result != null) ...[
              _CrisisAiView(ai: _result!),
              SizedBox(height: AppSpacing.md),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Fechar'),
                ),
              ),
            ] else ...[
              DropdownButtonFormField<String>(
                value: _emotionalState,
                decoration: const InputDecoration(labelText: 'Como você está?'),
                items: ChoiceLabels.emotionalStates.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _emotionalState = v!),
              ),
              if (_emotionalState == 'other')
                TextField(
                  controller: _emotionalOther,
                  decoration: const InputDecoration(labelText: 'Descreva'),
                ),
              SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: _impulseType,
                decoration:
                    const InputDecoration(labelText: 'Impulso que quer evitar'),
                items: ChoiceLabels.impulseTypes.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _impulseType = v!),
              ),
              if (_impulseType == 'other')
                TextField(
                  controller: _impulseOther,
                  decoration: const InputDecoration(labelText: 'Descreva'),
                ),
              SizedBox(height: AppSpacing.sm),
              Text('A resposta pode levar até 1 minuto.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      )),
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
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Enviar'),
                ),
              ),
            ],
            SizedBox(height: AppSpacing.sm),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Biblioteca de intervenções
// ---------------------------------------------------------------------------

class _LibraryTab extends ConsumerWidget {
  const _LibraryTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(wellnessInterventionsProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(wellnessInterventionsProvider);
        await ref.read(wellnessInterventionsProvider.future);
      },
      child: async.when(
        loading: () => const LoadingState(variant: LoadingVariant.list),
        error: (e, _) => Center(child: Text('Erro: $e')),
        data: (list) => list.isEmpty
            ? const EmptyState(
                icon: Icons.spa_outlined,
                title: 'Nenhuma intervenção disponível')
            : ListView(
                padding: const EdgeInsets.all(AppSpacing.md),
                children: list
                    .map((i) => AppCard(
                          margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                          padding: const EdgeInsets.all(AppSpacing.smd),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(i.title,
                                  style:
                                      Theme.of(context).textTheme.titleSmall),
                              Text(
                                [
                                  i.categoryDisplay ??
                                      ChoiceLabels.of(
                                          ChoiceLabels.wellnessCategories,
                                          i.category),
                                  if (i.durationMinutes != null)
                                    '${i.durationMinutes} min',
                                  if (i.difficultyDisplay != null)
                                    i.difficultyDisplay!,
                                ].join(' · '),
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurfaceVariant,
                                    ),
                              ),
                              if (i.description?.isNotEmpty ?? false) ...[
                                SizedBox(height: AppSpacing.xs),
                                Text(i.description!,
                                    style:
                                        Theme.of(context).textTheme.bodySmall),
                              ],
                              SizedBox(height: AppSpacing.xs),
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton(
                                  onPressed: () async {
                                    try {
                                      await ref
                                          .read(wellnessServiceProvider)
                                          .completeIntervention(i.id);
                                      ref.invalidate(wellnessDashboardProvider);
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(const SnackBar(
                                          content: Text('Marcada como feita.'),
                                        ));
                                      }
                                    } on ApiException catch (e) {
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(SnackBar(
                                          content: Text(e.message),
                                        ));
                                      }
                                    }
                                  },
                                  child: const Text('Concluí'),
                                ),
                              ),
                            ],
                          ),
                        ))
                    .toList(),
              ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Relatório semanal
// ---------------------------------------------------------------------------

class _ReportTab extends ConsumerStatefulWidget {
  const _ReportTab();

  @override
  ConsumerState<_ReportTab> createState() => _ReportTabState();
}

class _ReportTabState extends ConsumerState<_ReportTab> {
  bool _generating = false;

  Future<void> _generate() async {
    setState(() => _generating = true);
    try {
      await ref.read(wellnessServiceProvider).generateWeeklyReport();
      ref.invalidate(wellnessWeeklyReportsProvider);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(wellnessWeeklyReportsProvider);
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _generating ? null : _generate,
        icon: _generating
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.auto_awesome_outlined),
        label: const Text('Gerar'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(wellnessWeeklyReportsProvider);
          await ref.read(wellnessWeeklyReportsProvider.future);
        },
        child: async.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (e, _) => Center(child: Text('Erro: $e')),
          data: (list) => list.isEmpty
              ? const EmptyState(
                  icon: Icons.summarize_outlined,
                  title: 'Nenhum relatório gerado')
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  children: list
                      .map((r) => AppCard(
                            margin:
                                const EdgeInsets.only(bottom: AppSpacing.sm),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  r.weekStart == null
                                      ? 'Semana'
                                      : '${AppFormatters.date(r.weekStart!)} – '
                                          '${r.weekEnd == null ? '' : AppFormatters.date(r.weekEnd!)}',
                                  style: Theme.of(context).textTheme.titleSmall,
                                ),
                                if (r.aiSummary?.isNotEmpty ?? false) ...[
                                  SizedBox(height: AppSpacing.xs),
                                  Text(r.aiSummary!,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall),
                                ],
                                if (r.attentionPoints.isNotEmpty) ...[
                                  SizedBox(height: AppSpacing.sm),
                                  Text('Pontos de atenção',
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelMedium),
                                  ...r.attentionPoints.map((p) => Text('• $p',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall)),
                                ],
                                if (r.suggestions.isNotEmpty) ...[
                                  SizedBox(height: AppSpacing.sm),
                                  Text('Sugestões',
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelMedium),
                                  ...r.suggestions.map((s) => Text('• $s',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall)),
                                ],
                              ],
                            ),
                          ))
                      .toList(),
                ),
        ),
      ),
    );
  }
}
