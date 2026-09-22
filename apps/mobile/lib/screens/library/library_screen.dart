import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/library.dart';
import '../../providers/library_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../widgets/app_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/page_header.dart';
import '../../widgets/row_actions.dart';
import 'knowledge_map.dart';
import 'library_forms.dart';
import '../../utils/formatters.dart';

/// Biblioteca / Intelecto: livros, cursos, flashcards (revisão SM-2) e
/// habilidades. Capa, leitor EPUB, destaques, grafo e importações
/// (Goodreads/Kindle) continuam exclusivos do web.
class LibraryScreen extends StatelessWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 5,
      child: Scaffold(
        body: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md, AppSpacing.md, AppSpacing.md, 0),
              child: AppPageHeader(
                title: 'Biblioteca',
                subtitle: 'Livros, cursos e habilidades',
                icon: Icons.menu_book_rounded,
                color: context.semanticColors.info,
                trailing: const _ImportMenu(),
              ),
            ),
            const TabBar(isScrollable: true, tabs: [
              Tab(text: 'Livros'),
              Tab(text: 'Cursos'),
              Tab(text: 'Revisão'),
              Tab(text: 'Habilidades'),
              Tab(text: 'Grafo'),
            ]),
            const Expanded(
              child: TabBarView(children: [
                _BooksTab(),
                _CoursesTab(),
                _ReviewTab(),
                _SkillsTab(),
                _GraphTab(),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

Future<void> _guard(BuildContext context, Future<void> Function() fn) async {
  try {
    await fn();
  } on ApiException catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }
}

/// Lista com pull-to-refresh + FAB, reutilizada pelas abas.
class _ListTab<T> extends ConsumerWidget {
  final AutoDisposeFutureProvider<List<T>> provider;
  final VoidCallback? onAdd;
  final IconData emptyIcon;
  final String emptyTitle;
  final Widget Function(BuildContext, WidgetRef, T) itemBuilder;

  const _ListTab({
    required this.provider,
    required this.onAdd,
    required this.emptyIcon,
    required this.emptyTitle,
    required this.itemBuilder,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(provider);
    return Scaffold(
      floatingActionButton: onAdd == null
          ? null
          : FloatingActionButton(
              onPressed: onAdd, child: const Icon(Icons.add)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(provider);
          await ref.read(provider.future);
        },
        child: async.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (e, _) => Center(child: Text('Erro: $e')),
          data: (items) => items.isEmpty
              ? ListView(children: [
                  EmptyState(icon: emptyIcon, title: emptyTitle),
                ])
              : ListView.builder(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  itemCount: items.length,
                  itemBuilder: (c, i) => itemBuilder(c, ref, items[i]),
                ),
        ),
      ),
    );
  }
}

// ---- Livros -----------------------------------------------------------------

class _BooksTab extends StatelessWidget {
  const _BooksTab();

  @override
  Widget build(BuildContext context) => _ListTab<Book>(
        provider: booksProvider,
        onAdd: () => showBookFormSheet(context),
        emptyIcon: Icons.menu_book_outlined,
        emptyTitle: 'Nenhum livro cadastrado',
        itemBuilder: (context, ref, b) {
          final theme = Theme.of(context);
          return AppCard(
            margin: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.smd, AppSpacing.smd,
                  AppSpacing.xs, AppSpacing.smd),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    if (b.hasCover) ...[
                      _Cover(bookId: b.id),
                      SizedBox(width: AppSpacing.smd),
                    ],
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(b.title, style: theme.textTheme.titleSmall),
                          Text(
                            '${b.authorsNames.join(', ')} · '
                            '${ChoiceLabels.of(ChoiceLabels.readStatuses, b.readStatus)}'
                            '${b.rating == null ? '' : ' · ${'★' * b.rating!}'}',
                            style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    RowActionsMenu(
                      onEdit: () => showBookFormSheet(context, existing: b),
                      onDelete: () => _guard(context, () async {
                        await ref.read(booksServiceProvider).delete(b.id);
                        ref.invalidate(booksProvider);
                      }),
                      deleteConfirmTitle: 'Excluir livro',
                      deleteConfirmMessage: 'Excluir "${b.title}"?',
                    ),
                  ]),
                  SizedBox(height: AppSpacing.xs),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: b.progress,
                      minHeight: 6,
                      backgroundColor:
                          theme.colorScheme.surfaceContainerHighest,
                    ),
                  ),
                  Row(children: [
                    Expanded(
                      child: Text('${b.totalPagesRead} de ${b.pages} páginas',
                          style: theme.textTheme.bodySmall),
                    ),
                    TextButton(
                      style: TextButton.styleFrom(
                          visualDensity: VisualDensity.compact),
                      onPressed: () => showHighlightsSheet(context, b),
                      child: const Text('Destaques'),
                    ),
                    if (b.hasFile)
                      TextButton(
                        style: TextButton.styleFrom(
                            visualDensity: VisualDensity.compact),
                        onPressed: () =>
                            context.go('/planning/library/read/${b.id}'),
                        child: const Text('Ler'),
                      ),
                    if (b.readStatus != 'read')
                      TextButton(
                        style: TextButton.styleFrom(
                            visualDensity: VisualDensity.compact),
                        onPressed: () => showReadingSheet(context, b),
                        child: const Text('Registrar leitura'),
                      ),
                  ]),
                ],
              ),
            ),
          );
        },
      );
}

// ---- Cursos -----------------------------------------------------------------

class _CoursesTab extends StatelessWidget {
  const _CoursesTab();

  @override
  Widget build(BuildContext context) => _ListTab<Course>(
        provider: coursesProvider,
        onAdd: () => showCourseFormSheet(context),
        emptyIcon: Icons.school_outlined,
        emptyTitle: 'Nenhum curso cadastrado',
        itemBuilder: (context, ref, c) {
          final theme = Theme.of(context);
          return AppCard(
            onTap: () => context.go('/planning/library/courses/${c.id}'),
            margin: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.smd, AppSpacing.smd,
                  AppSpacing.xs, AppSpacing.smd),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c.title, style: theme.textTheme.titleSmall),
                          Text(
                            '${ChoiceLabels.of(ChoiceLabels.coursePlatforms, c.platform)}'
                            ' · ${ChoiceLabels.of(ChoiceLabels.courseStatuses, c.status)}',
                            style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    RowActionsMenu(
                      onEdit: () => showCourseFormSheet(context, existing: c),
                      onDelete: () => _guard(context, () async {
                        await ref.read(coursesServiceProvider).delete(c.id);
                        ref.invalidate(coursesProvider);
                      }),
                      deleteConfirmTitle: 'Excluir curso',
                      deleteConfirmMessage: 'Excluir "${c.title}"?',
                    ),
                  ]),
                  SizedBox(height: AppSpacing.xs),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: c.progress,
                      minHeight: 6,
                      backgroundColor:
                          theme.colorScheme.surfaceContainerHighest,
                    ),
                  ),
                  Text(
                    '${c.completedLessons}/${c.totalLessons} aulas · '
                    '${AppFormatters.number(c.investedHours)} h investidas',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          );
        },
      );
}

// ---- Revisão (flashcards SM-2) ------------------------------------------------

class _ReviewTab extends ConsumerStatefulWidget {
  const _ReviewTab();

  @override
  ConsumerState<_ReviewTab> createState() => _ReviewTabState();
}

class _ReviewTabState extends ConsumerState<_ReviewTab> {
  bool _revealed = false;
  bool _busy = false;

  static const _ratings = [
    (0, 'Errei'),
    (3, 'Difícil'),
    (4, 'Bom'),
    (5, 'Fácil'),
  ];

  Future<void> _rate(FlashCard card, int rating) async {
    setState(() => _busy = true);
    await _guard(context, () async {
      await ref.read(flashCardsServiceProvider).review(card.id, rating);
      ref.invalidate(dueFlashCardsProvider);
      _revealed = false;
    });
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(dueFlashCardsProvider);
    final theme = Theme.of(context);
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => showFlashCardFormSheet(context),
        child: const Icon(Icons.add),
      ),
      body: async.when(
        loading: () => const LoadingState(variant: LoadingVariant.list),
        error: (e, _) => Center(child: Text('Erro: $e')),
        data: (cards) {
          if (cards.isEmpty) {
            return const EmptyState(
              icon: Icons.task_alt_rounded,
              title: 'Nenhum flashcard para revisar hoje',
            );
          }
          final card = cards.first;
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Text('${cards.length} para revisar',
                  style: theme.textTheme.labelLarge),
              SizedBox(height: AppSpacing.sm),
              AppCard(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (card.bookTitle != null)
                        Text(card.bookTitle!,
                            style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant)),
                      SizedBox(height: AppSpacing.xs),
                      Text(card.front, style: theme.textTheme.titleMedium),
                      if (_revealed) ...[
                        const Divider(height: AppSpacing.lg),
                        Text(card.back, style: theme.textTheme.bodyLarge),
                      ],
                    ],
                  ),
                ),
              ),
              SizedBox(height: AppSpacing.md),
              if (!_revealed)
                FilledButton(
                    onPressed: () => setState(() => _revealed = true),
                    child: const Text('Mostrar resposta'))
              else
                Row(children: [
                  for (final (value, label) in _ratings)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: FilledButton.tonal(
                          onPressed: _busy ? null : () => _rate(card, value),
                          child: Text(label),
                        ),
                      ),
                    ),
                ]),
            ],
          );
        },
      ),
    );
  }
}

// ---- Habilidades --------------------------------------------------------------

class _SkillsTab extends StatelessWidget {
  const _SkillsTab();

  @override
  Widget build(BuildContext context) => _ListTab<Skill>(
        provider: skillsProvider,
        onAdd: () => showSkillFormSheet(context),
        emptyIcon: Icons.psychology_outlined,
        emptyTitle: 'Nenhuma habilidade cadastrada',
        itemBuilder: (context, ref, s) {
          final theme = Theme.of(context);
          return AppCard(
            margin: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: ListTile(
              title: Text(s.name),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${ChoiceLabels.of(ChoiceLabels.skillProficiencies, s.proficiency)}'
                    ' · ${ChoiceLabels.of(ChoiceLabels.skillStatuses, s.status)}',
                  ),
                  SizedBox(height: AppSpacing.xs),
                  LinearProgressIndicator(
                    value: (s.proficiencyLevel / 5).clamp(0, 1),
                    minHeight: 5,
                    backgroundColor: theme.colorScheme.surfaceContainerHighest,
                  ),
                ],
              ),
              trailing: RowActionsMenu(
                onEdit: () => showSkillFormSheet(context, existing: s),
                onDelete: () => _guard(context, () async {
                  await ref.read(skillsServiceProvider).delete(s.id);
                  ref.invalidate(skillsProvider);
                }),
                deleteConfirmTitle: 'Excluir habilidade',
                deleteConfirmMessage: 'Excluir "${s.name}"?',
              ),
            ),
          );
        },
      );
}

// ---- Grafo (vínculos manuais) ---------------------------------------------------

class _GraphList extends StatelessWidget {
  const _GraphList();

  @override
  Widget build(BuildContext context) => _ListTab<KnowledgeLink>(
        provider: knowledgeLinksProvider,
        onAdd: () => showKnowledgeLinkSheet(context),
        emptyIcon: Icons.hub_outlined,
        emptyTitle: 'Nenhum vínculo criado',
        itemBuilder: (context, ref, l) {
          String name(String type, String id) =>
              knowledgeItems(ref, type)
                  .where((i) => i.$1 == id)
                  .map((i) => i.$2)
                  .firstOrNull ??
              '(removido)';
          return AppCard(
            margin: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: ListTile(
              title: Text(
                  '${name(l.sourceType, l.sourceId)}  →  ${name(l.targetType, l.targetId)}'),
              subtitle: Text(
                  '${ChoiceLabels.of(knowledgeTypes, l.sourceType)} ${ChoiceLabels.of(knowledgeRelations, l.relation).toLowerCase()} ${ChoiceLabels.of(knowledgeTypes, l.targetType).toLowerCase()}'),
              trailing: IconButton(
                icon: const Icon(Icons.delete_outline),
                onPressed: () => _guard(context, () async {
                  await ref.read(knowledgeLinksServiceProvider).delete(l.id);
                  ref.invalidate(knowledgeLinksProvider);
                }),
              ),
            ),
          );
        },
      );
}

class _Cover extends ConsumerWidget {
  final int bookId;
  const _Cover({required this.bookId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bytes = ref.watch(bookCoverProvider(bookId)).valueOrNull;
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: SizedBox(
        width: 48,
        height: 68,
        child: bytes == null
            ? ColoredBox(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                child: const Icon(Icons.menu_book_outlined))
            : Image.memory(bytes, fit: BoxFit.cover),
      ),
    );
  }
}

/// Importação Goodreads (CSV) e Kindle (My Clippings.txt).
class _ImportMenu extends ConsumerWidget {
  const _ImportMenu();

  Future<void> _import(BuildContext context, WidgetRef ref, bool kindle) async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: kindle ? ['txt'] : ['csv'],
      withData: true,
    );
    final file = picked?.files.single;
    final bytes = file?.bytes;
    if (file == null || bytes == null || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      final service = ref.read(libraryImportServiceProvider);
      final msg = kindle
          ? await service.kindle(file.name, bytes)
          : await service.goodreads(file.name, bytes);
      ref
        ..invalidate(booksProvider)
        ..invalidate(authorsProvider);
      messenger.showSnackBar(SnackBar(content: Text(msg)));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => PopupMenuButton<bool>(
        tooltip: 'Importar',
        icon: const Icon(Icons.upload_file_outlined),
        onSelected: (kindle) => _import(context, ref, kindle),
        itemBuilder: (_) => const [
          PopupMenuItem(value: false, child: Text('Goodreads (CSV)')),
          PopupMenuItem(value: true, child: Text('Kindle (My Clippings.txt)')),
        ],
      );
}

// ---- Grafo: lista + mapa ---------------------------------------------------------

class _GraphTab extends StatefulWidget {
  const _GraphTab();

  @override
  State<_GraphTab> createState() => _GraphTabState();
}

class _GraphTabState extends State<_GraphTab> {
  bool _map = false;

  @override
  Widget build(BuildContext context) => Column(children: [
        Padding(
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Vínculos')),
              ButtonSegment(value: true, label: Text('Mapa')),
            ],
            selected: {_map},
            onSelectionChanged: (v) => setState(() => _map = v.first),
          ),
        ),
        Expanded(child: _map ? const KnowledgeMap() : const _GraphList()),
      ]);
}
