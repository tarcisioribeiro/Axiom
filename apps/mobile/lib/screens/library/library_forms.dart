import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/library.dart';
import '../../providers/finance_providers.dart';
import '../../providers/library_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/feedback.dart';
import '../../widgets/form_sheet_submit_footer.dart';

Future<T?> _sheet<T>(BuildContext context, WidgetBuilder builder) =>
    showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: builder,
    );

/// Corpo comum dos sheets: rolagem + espaço do teclado + título.
class _SheetBody extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _SheetBody({required this.title, required this.children});

  @override
  Widget build(BuildContext context) => SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.only(
            left: AppSpacing.md,
            right: AppSpacing.md,
            bottom: AppSpacing.md + MediaQuery.of(context).viewInsets.bottom,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              SizedBox(height: AppSpacing.md),
              ...children,
              SizedBox(height: AppSpacing.sm),
            ],
          ),
        ),
      );
}

Widget _dropdown(
  String label,
  Map<String, String> options,
  String? value,
  ValueChanged<String> onChanged,
) =>
    Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: DropdownButtonFormField<String>(
        initialValue: options.containsKey(value) ? value : null,
        isExpanded: true,
        decoration: InputDecoration(labelText: label),
        items: options.entries
            .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
            .toList(),
        onChanged: (v) => v == null ? null : onChanged(v),
      ),
    );

/// Envia [action], mostra o erro no rodapé e fecha o sheet no sucesso.
mixin _SaveMixin<W extends ConsumerStatefulWidget> on ConsumerState<W> {
  bool saving = false;
  String? error;

  Future<void> submit(Future<void> Function() action) async {
    setState(() {
      saving = true;
      error = null;
    });
    try {
      await action();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<int> ownerId() async {
    final m = await ref.read(currentMemberProvider.future);
    if (m == null) {
      throw const ApiException(null, 'Perfil de membro não encontrado.');
    }
    return m.id;
  }
}

// ---- Livro ------------------------------------------------------------------

Future<void> showBookFormSheet(BuildContext context, {Book? existing}) =>
    _sheet(context, (_) => _BookForm(existing: existing));

class _BookForm extends ConsumerStatefulWidget {
  final Book? existing;
  const _BookForm({this.existing});

  @override
  ConsumerState<_BookForm> createState() => _BookFormState();
}

class _BookFormState extends ConsumerState<_BookForm> with _SaveMixin {
  late final _title = TextEditingController(text: widget.existing?.title);
  late final _pages =
      TextEditingController(text: '${widget.existing?.pages ?? ''}');
  final _newAuthor = TextEditingController();
  late final Set<int> _authors = {...?widget.existing?.authors};
  late String _language = widget.existing?.language ?? 'Por';
  late String _genre = widget.existing?.genre ?? 'Fiction';
  late String _type = widget.existing?.literarytype ?? 'book';
  late String _media = widget.existing?.mediaType ?? 'Phi';
  late String _status = widget.existing?.readStatus ?? 'to_read';
  int? _rating;

  @override
  void initState() {
    super.initState();
    _rating = widget.existing?.rating;
  }

  @override
  void dispose() {
    _title.dispose();
    _pages.dispose();
    _newAuthor.dispose();
    super.dispose();
  }

  Future<void> _addAuthor() async {
    final name = _newAuthor.text.trim();
    if (name.isEmpty) return;
    try {
      final owner = await ownerId();
      final a = await ref
          .read(authorsServiceProvider)
          .create({'name': name, 'owner': owner});
      ref.invalidate(authorsProvider);
      setState(() {
        _authors.add(a.id);
        _newAuthor.clear();
      });
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  Future<void> _save() => submit(() async {
        if (_title.text.trim().isEmpty || _authors.isEmpty) {
          throw const ApiException(
              null, 'Informe o título e ao menos um autor.');
        }
        final body = {
          'title': _title.text.trim(),
          'authors': _authors.toList(),
          'pages': int.tryParse(_pages.text) ?? 1,
          'language': _language,
          'genre': _genre,
          'literarytype': _type,
          'media_type': _media,
          'read_status': _status,
          'rating': _rating,
        };
        final service = ref.read(booksServiceProvider);
        if (widget.existing == null) {
          await service.create({...body, 'owner': await ownerId()});
        } else {
          await service.patch(widget.existing!.id, body);
        }
        ref.invalidate(booksProvider);
      });

  @override
  Widget build(BuildContext context) {
    final authors = ref.watch(authorsProvider).valueOrNull ?? const <Author>[];
    return _SheetBody(
      title: widget.existing == null ? 'Novo livro' : 'Editar livro',
      children: [
        TextField(
            controller: _title,
            decoration: const InputDecoration(labelText: 'Título')),
        SizedBox(height: AppSpacing.sm),
        Text('Autores', style: Theme.of(context).textTheme.labelLarge),
        Wrap(spacing: AppSpacing.xs, children: [
          for (final a in authors)
            FilterChip(
              label: Text(a.name),
              selected: _authors.contains(a.id),
              onSelected: (v) => setState(
                  () => v ? _authors.add(a.id) : _authors.remove(a.id)),
            ),
        ]),
        Row(children: [
          Expanded(
            child: TextField(
              controller: _newAuthor,
              decoration: const InputDecoration(labelText: 'Novo autor'),
              onSubmitted: (_) => _addAuthor(),
            ),
          ),
          IconButton(onPressed: _addAuthor, icon: const Icon(Icons.add)),
        ]),
        SizedBox(height: AppSpacing.sm),
        TextField(
          controller: _pages,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Páginas'),
        ),
        _dropdown('Status', ChoiceLabels.readStatuses, _status,
            (v) => setState(() => _status = v)),
        _dropdown('Idioma', ChoiceLabels.bookLanguages, _language,
            (v) => setState(() => _language = v)),
        _dropdown('Gênero', ChoiceLabels.bookGenres, _genre,
            (v) => setState(() => _genre = v)),
        _dropdown('Tipo', ChoiceLabels.literaryTypes, _type,
            (v) => setState(() => _type = v)),
        _dropdown('Mídia', const {'Phi': 'Física', 'Dig': 'Digital'}, _media,
            (v) => setState(() => _media = v)),
        SizedBox(height: AppSpacing.sm),
        Row(children: [
          const Text('Nota'),
          for (var i = 1; i <= 5; i++)
            IconButton(
              visualDensity: VisualDensity.compact,
              onPressed: () =>
                  setState(() => _rating = _rating == i ? null : i),
              icon: Icon(
                (_rating ?? 0) >= i ? Icons.star : Icons.star_border,
                color: context.palette.star,
              ),
            ),
        ]),
        if (widget.existing != null) ...[
          Wrap(spacing: AppSpacing.sm, children: [
            OutlinedButton.icon(
              onPressed: () => _attach(cover: true),
              icon: const Icon(Icons.image_outlined),
              label: const Text('Capa'),
            ),
            OutlinedButton.icon(
              onPressed: () => _attach(cover: false),
              icon: const Icon(Icons.attach_file),
              label: const Text('Arquivo EPUB/PDF'),
            ),
          ]),
        ],
        FormSheetSubmitFooter(error: error, isSaving: saving, onSubmit: _save),
      ],
    );
  }

  Future<void> _attach({required bool cover}) async {
    final picked = await FilePicker.platform.pickFiles(
      type: cover ? FileType.image : FileType.custom,
      allowedExtensions: cover ? null : ['epub', 'pdf'],
      withData: true,
    );
    final f = picked?.files.single;
    final bytes = f?.bytes;
    if (f == null || bytes == null) return;
    await submit(() async {
      final service = ref.read(booksServiceProvider);
      final id = widget.existing!.id;
      if (cover) {
        await service.uploadCover(id, f.name, bytes);
        ref.invalidate(bookCoverProvider(id));
      } else {
        await service.uploadFile(id, f.name, bytes);
      }
      ref.invalidate(booksProvider);
    });
  }
}

// ---- Registrar leitura ---------------------------------------------------------

Future<void> showReadingSheet(BuildContext context, Book book) =>
    _sheet(context, (_) => _ReadingForm(book: book));

class _ReadingForm extends ConsumerStatefulWidget {
  final Book book;
  const _ReadingForm({required this.book});

  @override
  ConsumerState<_ReadingForm> createState() => _ReadingFormState();
}

class _ReadingFormState extends ConsumerState<_ReadingForm> with _SaveMixin {
  final _pages = TextEditingController(text: '10');
  final _minutes = TextEditingController(text: '30');
  DateTime _date = DateTime.now();

  @override
  void dispose() {
    _pages.dispose();
    _minutes.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );
    if (d != null) setState(() => _date = d);
  }

  Future<void> _save() => submit(() async {
        await ref.read(readingsServiceProvider).log(
              bookId: widget.book.id,
              ownerId: await ownerId(),
              date: AppFormatters.apiDate(_date),
              pagesRead: int.tryParse(_pages.text) ?? 1,
              minutes: int.tryParse(_minutes.text) ?? 30,
            );
        ref.invalidate(booksProvider);
      });

  @override
  Widget build(BuildContext context) => _SheetBody(
        title: 'Leitura — ${widget.book.title}',
        children: [
          Row(children: [
            Expanded(
              child: TextField(
                controller: _pages,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Páginas lidas'),
              ),
            ),
            SizedBox(width: AppSpacing.sm),
            Expanded(
              child: TextField(
                controller: _minutes,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Minutos'),
              ),
            ),
          ]),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Data'),
            subtitle: Text(AppFormatters.date(_date)),
            trailing: const Icon(Icons.calendar_today_outlined, size: 18),
            onTap: _pickDate,
          ),
          FormSheetSubmitFooter(
              error: error, isSaving: saving, onSubmit: _save),
        ],
      );
}

// ---- Curso ------------------------------------------------------------------

Future<void> showCourseFormSheet(BuildContext context, {Course? existing}) =>
    _sheet(context, (_) => _CourseForm(existing: existing));

class _CourseForm extends ConsumerStatefulWidget {
  final Course? existing;
  const _CourseForm({this.existing});

  @override
  ConsumerState<_CourseForm> createState() => _CourseFormState();
}

class _CourseFormState extends ConsumerState<_CourseForm> with _SaveMixin {
  late final _title = TextEditingController(text: widget.existing?.title);
  late final _url = TextEditingController(text: widget.existing?.url);
  late final _hours = TextEditingController(
      text: widget.existing?.estimatedHours?.toString() ?? '');
  late String _platform = widget.existing?.platform ?? 'other';
  late String _category = widget.existing?.category ?? 'technology';
  late String _status = widget.existing?.status ?? 'not_started';

  @override
  void dispose() {
    _title.dispose();
    _url.dispose();
    _hours.dispose();
    super.dispose();
  }

  Future<void> _save() => submit(() async {
        if (_title.text.trim().isEmpty) {
          throw const ApiException(null, 'Informe o título.');
        }
        final body = {
          'title': _title.text.trim(),
          'platform': _platform,
          'category': _category,
          'status': _status,
          'url': _url.text.trim().isEmpty ? null : _url.text.trim(),
          'estimated_hours': double.tryParse(_hours.text.replaceAll(',', '.')),
        };
        final service = ref.read(coursesServiceProvider);
        if (widget.existing == null) {
          await service.create({...body, 'owner': await ownerId()});
        } else {
          await service.patch(widget.existing!.id, body);
        }
        ref.invalidate(coursesProvider);
      });

  @override
  Widget build(BuildContext context) => _SheetBody(
        title: widget.existing == null ? 'Novo curso' : 'Editar curso',
        children: [
          TextField(
              controller: _title,
              decoration: const InputDecoration(labelText: 'Título')),
          _dropdown('Plataforma', ChoiceLabels.coursePlatforms, _platform,
              (v) => setState(() => _platform = v)),
          _dropdown('Categoria', ChoiceLabels.intellectCategories, _category,
              (v) => setState(() => _category = v)),
          _dropdown('Status', ChoiceLabels.courseStatuses, _status,
              (v) => setState(() => _status = v)),
          SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _hours,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Horas estimadas'),
          ),
          SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _url,
            keyboardType: TextInputType.url,
            decoration: const InputDecoration(labelText: 'Link'),
          ),
          FormSheetSubmitFooter(
              error: error, isSaving: saving, onSubmit: _save),
        ],
      );
}

// ---- Habilidade -------------------------------------------------------------

Future<void> showSkillFormSheet(BuildContext context, {Skill? existing}) =>
    _sheet(context, (_) => _SkillForm(existing: existing));

class _SkillForm extends ConsumerStatefulWidget {
  final Skill? existing;
  const _SkillForm({this.existing});

  @override
  ConsumerState<_SkillForm> createState() => _SkillFormState();
}

class _SkillFormState extends ConsumerState<_SkillForm> with _SaveMixin {
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _notes = TextEditingController(text: widget.existing?.notes);
  late String _category = widget.existing?.category ?? 'technology';
  late String _proficiency = widget.existing?.proficiency ?? 'beginner';
  late String _status = widget.existing?.status ?? 'learning';

  @override
  void dispose() {
    _name.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() => submit(() async {
        if (_name.text.trim().isEmpty) {
          throw const ApiException(null, 'Informe o nome.');
        }
        final body = {
          'name': _name.text.trim(),
          'category': _category,
          'proficiency': _proficiency,
          'status': _status,
          'notes': _notes.text.trim(),
        };
        final service = ref.read(skillsServiceProvider);
        if (widget.existing == null) {
          await service.create({...body, 'owner': await ownerId()});
        } else {
          await service.patch(widget.existing!.id, body);
        }
        ref.invalidate(skillsProvider);
      });

  @override
  Widget build(BuildContext context) => _SheetBody(
        title:
            widget.existing == null ? 'Nova habilidade' : 'Editar habilidade',
        children: [
          TextField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Nome')),
          _dropdown('Categoria', ChoiceLabels.intellectCategories, _category,
              (v) => setState(() => _category = v)),
          _dropdown('Nível', ChoiceLabels.skillProficiencies, _proficiency,
              (v) => setState(() => _proficiency = v)),
          _dropdown('Status', ChoiceLabels.skillStatuses, _status,
              (v) => setState(() => _status = v)),
          SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _notes,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Notas'),
          ),
          FormSheetSubmitFooter(
              error: error, isSaving: saving, onSubmit: _save),
        ],
      );
}

// ---- Destaques ----------------------------------------------------------------

Future<void> showHighlightsSheet(BuildContext context, Book book) =>
    _sheet(context, (_) => _HighlightsSheet(book: book));

class _HighlightsSheet extends ConsumerStatefulWidget {
  final Book book;
  const _HighlightsSheet({required this.book});

  @override
  ConsumerState<_HighlightsSheet> createState() => _HighlightsSheetState();
}

class _HighlightsSheetState extends ConsumerState<_HighlightsSheet> {
  final _text = TextEditingController();
  final _page = TextEditingController();
  String _type = 'quote';
  bool _busy = false;
  String? _error;

  static const _types = {'quote': 'Citação', 'note': 'Nota', 'idea': 'Ideia'};

  @override
  void dispose() {
    _text.dispose();
    _page.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() fn) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await fn();
      ref.invalidate(bookHighlightsProvider(widget.book.id));
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _add() async {
    if (_text.text.trim().isEmpty) return;
    await _run(() async {
      await ref.read(highlightsServiceProvider).create({
        'book': widget.book.id,
        'owner': await _owner(),
        'text': _text.text.trim(),
        'highlight_type': _type,
        if (int.tryParse(_page.text) != null)
          'page_number': int.parse(_page.text),
      });
      _text.clear();
      _page.clear();
    });
  }

  Future<int> _owner() async {
    final m = await ref.read(currentMemberProvider.future);
    if (m == null) {
      throw const ApiException(null, 'Perfil de membro não encontrado.');
    }
    return m.id;
  }

  Future<void> _generate() => _run(() async {
        final n = await ref
            .read(highlightsServiceProvider)
            .generateFlashcards(widget.book.id);
        ref
          ..invalidate(dueFlashCardsProvider)
          ..invalidate(allFlashCardsProvider);
        if (mounted) {
          showAppToast(context, '$n flashcard(s) criado(s).');
        }
      });

  @override
  Widget build(BuildContext context) {
    final items =
        ref.watch(bookHighlightsProvider(widget.book.id)).valueOrNull ??
            const [];
    return _SheetBody(
      title: 'Destaques — ${widget.book.title}',
      children: [
        for (final h in items)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(h.text, maxLines: 4, overflow: TextOverflow.ellipsis),
            subtitle: Text([
              ChoiceLabels.of(_types, h.type),
              if (h.pageNumber != null) 'p. ${h.pageNumber}',
            ].join(' · ')),
            trailing: IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: _busy
                  ? null
                  : () => _run(
                      () => ref.read(highlightsServiceProvider).delete(h.id)),
            ),
          ),
        if (items.isEmpty) const Text('Nenhum destaque ainda.'),
        const Divider(),
        TextField(
          controller: _text,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Novo destaque'),
        ),
        Row(children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: _type,
              decoration: const InputDecoration(labelText: 'Tipo'),
              items: _types.entries
                  .map((e) =>
                      DropdownMenuItem(value: e.key, child: Text(e.value)))
                  .toList(),
              onChanged: (v) => setState(() => _type = v!),
            ),
          ),
          SizedBox(width: AppSpacing.sm),
          SizedBox(
            width: 90,
            child: TextField(
              controller: _page,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Página'),
            ),
          ),
        ]),
        FormSheetSubmitFooter(
            error: _error, isSaving: _busy, label: 'Adicionar', onSubmit: _add),
        if (items.isNotEmpty)
          TextButton.icon(
            onPressed: _busy ? null : _generate,
            icon: const Icon(Icons.style_outlined),
            label: const Text('Gerar flashcards dos destaques'),
          ),
      ],
    );
  }
}

// ---- Flashcard manual ---------------------------------------------------------

Future<void> showFlashCardFormSheet(BuildContext context) =>
    _sheet(context, (_) => const _FlashCardForm());

class _FlashCardForm extends ConsumerStatefulWidget {
  const _FlashCardForm();

  @override
  ConsumerState<_FlashCardForm> createState() => _FlashCardFormState();
}

class _FlashCardFormState extends ConsumerState<_FlashCardForm>
    with _SaveMixin {
  final _front = TextEditingController();
  final _back = TextEditingController();
  int? _book;

  @override
  void dispose() {
    _front.dispose();
    _back.dispose();
    super.dispose();
  }

  Future<void> _save() => submit(() async {
        if (_front.text.trim().isEmpty || _back.text.trim().isEmpty) {
          throw const ApiException(null, 'Preencha frente e verso.');
        }
        await ref.read(flashCardsServiceProvider).create({
          'front': _front.text.trim(),
          'back': _back.text.trim(),
          if (_book != null) 'book': _book,
        });
        ref
          ..invalidate(dueFlashCardsProvider)
          ..invalidate(allFlashCardsProvider);
      });

  @override
  Widget build(BuildContext context) {
    final books = ref.watch(booksProvider).valueOrNull ?? const <Book>[];
    return _SheetBody(title: 'Novo flashcard', children: [
      TextField(
          controller: _front,
          maxLines: 2,
          decoration: const InputDecoration(labelText: 'Frente (pergunta)')),
      SizedBox(height: AppSpacing.sm),
      TextField(
          controller: _back,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Verso (resposta)')),
      SizedBox(height: AppSpacing.sm),
      DropdownButtonFormField<int?>(
        initialValue: _book,
        isExpanded: true,
        decoration: const InputDecoration(labelText: 'Livro (opcional)'),
        items: [
          const DropdownMenuItem<int?>(value: null, child: Text('Nenhum')),
          ...books.map((b) => DropdownMenuItem<int?>(
              value: b.id,
              child: Text(b.title, overflow: TextOverflow.ellipsis))),
        ],
        onChanged: (v) => setState(() => _book = v),
      ),
      FormSheetSubmitFooter(error: error, isSaving: saving, onSubmit: _save),
    ]);
  }
}

// ---- Vínculo do grafo ---------------------------------------------------------

Future<void> showKnowledgeLinkSheet(BuildContext context) =>
    _sheet(context, (_) => const _LinkForm());

const knowledgeTypes = {
  'book': 'Livro',
  'course': 'Curso',
  'skill': 'Habilidade',
  'author': 'Autor',
};
const knowledgeRelations = {
  'relates': 'Relaciona',
  'supports': 'Apoia',
  'contradicts': 'Contradiz',
  'deepens': 'Aprofunda',
  'derived_from': 'Derivado de',
  'applies': 'Aplica',
};

/// (uuid, nome) de cada item de um tipo, a partir dos providers já em cache.
List<(String, String)> knowledgeItems(WidgetRef ref, String type) {
  switch (type) {
    case 'book':
      return [
        for (final b in ref.watch(booksProvider).valueOrNull ?? const <Book>[])
          (b.uuid, b.title)
      ];
    case 'course':
      return [
        for (final c
            in ref.watch(coursesProvider).valueOrNull ?? const <Course>[])
          (c.uuid, c.title)
      ];
    case 'skill':
      return [
        for (final s
            in ref.watch(skillsProvider).valueOrNull ?? const <Skill>[])
          (s.uuid, s.name)
      ];
    default:
      return [
        for (final a
            in ref.watch(authorsProvider).valueOrNull ?? const <Author>[])
          (a.uuid, a.name)
      ];
  }
}

class _LinkForm extends ConsumerStatefulWidget {
  const _LinkForm();

  @override
  ConsumerState<_LinkForm> createState() => _LinkFormState();
}

class _LinkFormState extends ConsumerState<_LinkForm> with _SaveMixin {
  String _sType = 'book';
  String _tType = 'skill';
  String? _sId;
  String? _tId;
  String _relation = 'relates';

  Widget _picker(String label, String type, String? id,
      ValueChanged<String> onType, ValueChanged<String?> onId) {
    final items = knowledgeItems(ref, type);
    return Row(children: [
      SizedBox(
        width: 120,
        child: DropdownButtonFormField<String>(
          initialValue: type,
          decoration: InputDecoration(labelText: label),
          items: knowledgeTypes.entries
              .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
              .toList(),
          onChanged: (v) => onType(v!),
        ),
      ),
      SizedBox(width: AppSpacing.sm),
      Expanded(
        child: DropdownButtonFormField<String>(
          key: ValueKey('$label-$type'),
          initialValue: items.any((i) => i.$1 == id) ? id : null,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Item'),
          items: items
              .map((i) => DropdownMenuItem(
                  value: i.$1,
                  child: Text(i.$2, overflow: TextOverflow.ellipsis)))
              .toList(),
          onChanged: onId,
        ),
      ),
    ]);
  }

  Future<void> _save() => submit(() async {
        if (_sId == null || _tId == null) {
          throw const ApiException(null, 'Escolha origem e destino.');
        }
        await ref.read(knowledgeLinksServiceProvider).create({
          'source_type': _sType,
          'source_id': _sId,
          'target_type': _tType,
          'target_id': _tId,
          'relation_label': _relation,
          'owner': await ownerId(),
        });
        ref.invalidate(knowledgeLinksProvider);
      });

  @override
  Widget build(BuildContext context) =>
      _SheetBody(title: 'Novo vínculo', children: [
        _picker(
            'Origem',
            _sType,
            _sId,
            (v) => setState(() {
                  _sType = v;
                  _sId = null;
                }),
            (v) => setState(() => _sId = v)),
        _dropdown('Relação', knowledgeRelations, _relation,
            (v) => setState(() => _relation = v)),
        SizedBox(height: AppSpacing.sm),
        _picker(
            'Destino',
            _tType,
            _tId,
            (v) => setState(() {
                  _tType = v;
                  _tId = null;
                }),
            (v) => setState(() => _tId = v)),
        FormSheetSubmitFooter(error: error, isSaving: saving, onSubmit: _save),
      ]);
}
