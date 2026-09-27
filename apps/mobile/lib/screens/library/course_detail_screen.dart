import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/finance_providers.dart';
import '../../providers/library_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/feedback.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/page_header.dart';

/// Módulos e aulas de um curso: marcar aula como concluída (recalcula o
/// progresso e as horas no backend), adicionar e remover.
class CourseDetailScreen extends ConsumerWidget {
  final int courseId;
  const CourseDetailScreen({super.key, required this.courseId});

  Future<void> _run(
      BuildContext context, WidgetRef ref, Future<void> Function() fn) async {
    try {
      await fn();
      ref
        ..invalidate(courseModulesProvider(courseId))
        ..invalidate(coursesProvider);
    } on ApiException catch (e) {
      if (context.mounted) {
        showAppToast(context, e.message, kind: ToastKind.error);
      }
    }
  }

  Future<String?> _ask(BuildContext context, String title) {
    final c = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
            controller: c,
            autofocus: true,
            decoration: const InputDecoration(labelText: 'Título')),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, c.text.trim()),
              child: const Text('Salvar')),
        ],
      ),
    );
  }

  Future<int> _owner(WidgetRef ref) async {
    final m = await ref.read(currentMemberProvider.future);
    if (m == null) {
      throw const ApiException(null, 'Perfil de membro não encontrado.');
    }
    return m.id;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(courseModulesProvider(courseId));
    final title = ref
            .watch(coursesProvider)
            .valueOrNull
            ?.where((c) => c.id == courseId)
            .firstOrNull
            ?.title ??
        'Curso';
    return Scaffold(
      appBar: AppBar(
        title: ModuleAppBarTitle(
          icon: Icons.school_outlined,
          color: context.palette.intellect,
          title: Text(title),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Módulo'),
        onPressed: () async {
          final name = await _ask(context, 'Novo módulo');
          if (name == null || name.isEmpty || !context.mounted) return;
          final count = async.valueOrNull?.length ?? 0;
          await _run(context, ref, () async {
            await ref.read(courseModulesServiceProvider).create({
              'course': courseId,
              'title': name,
              'order': count + 1,
              'owner': await _owner(ref),
            });
          });
        },
      ),
      body: async.when(
        loading: () => const LoadingState(variant: LoadingVariant.list),
        error: (e, _) => ErrorState(
            error: e,
            onRetry: () => ref.invalidate(courseModulesProvider(courseId))),
        data: (modules) => modules.isEmpty
            ? const EmptyState(
                icon: Icons.view_module_outlined, title: 'Nenhum módulo')
            : ListView(
                padding: const EdgeInsets.only(bottom: 88),
                children: [
                  for (final m in modules)
                    ExpansionTile(
                      initiallyExpanded: true,
                      title: Text(m.title),
                      subtitle: Text(
                          '${m.lessons.where((l) => l.isCompleted).length}/${m.lessons.length} aulas'),
                      trailing: PopupMenuButton<int>(
                        onSelected: (v) async {
                          if (v == 1) {
                            await _run(
                                context,
                                ref,
                                () => ref
                                    .read(courseModulesServiceProvider)
                                    .delete(m.id));
                            return;
                          }
                          final name = await _ask(context, 'Nova aula');
                          if (name == null ||
                              name.isEmpty ||
                              !context.mounted) {
                            return;
                          }
                          await _run(context, ref, () async {
                            await ref
                                .read(courseLessonsServiceProvider)
                                .create({
                              'module': m.id,
                              'title': name,
                              'order': m.lessons.length + 1,
                              'owner': await _owner(ref),
                            });
                          });
                        },
                        itemBuilder: (_) => const [
                          PopupMenuItem(
                              value: 0, child: Text('Adicionar aula')),
                          PopupMenuItem(
                              value: 1, child: Text('Excluir módulo')),
                        ],
                      ),
                      childrenPadding:
                          const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                      children: [
                        for (final l in m.lessons)
                          Dismissible(
                            key: ValueKey('lesson-${l.id}'),
                            direction: DismissDirection.endToStart,
                            background: Container(
                              color: Theme.of(context).colorScheme.error,
                              alignment: Alignment.centerRight,
                              padding:
                                  const EdgeInsets.only(right: AppSpacing.md),
                              child: const Icon(Icons.delete_outline,
                                  color: Colors.white),
                            ),
                            onDismissed: (_) => _run(
                                context,
                                ref,
                                () => ref
                                    .read(courseLessonsServiceProvider)
                                    .delete(l.id)),
                            child: CheckboxListTile(
                              contentPadding: EdgeInsets.zero,
                              value: l.isCompleted,
                              title: Text(l.title),
                              onChanged: (_) => _run(
                                  context,
                                  ref,
                                  () => ref
                                      .read(courseLessonsServiceProvider)
                                      .toggle(l.id)),
                            ),
                          ),
                      ],
                    ),
                ],
              ),
      ),
    );
  }
}
