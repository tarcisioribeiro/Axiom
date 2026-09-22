import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/library_providers.dart';
import '../../utils/epub_text.dart';

final _epubProvider =
    FutureProvider.autoDispose.family<List<EpubChapter>, int>((ref, id) async {
  final bytes = await ref.watch(booksServiceProvider).file(id);
  return parseEpub(bytes);
});

/// Leitor EPUB em texto: navega por partes do *spine* e ajusta a fonte.
class EpubReaderScreen extends ConsumerStatefulWidget {
  final int bookId;
  const EpubReaderScreen({super.key, required this.bookId});

  @override
  ConsumerState<EpubReaderScreen> createState() => _EpubReaderScreenState();
}

class _EpubReaderScreenState extends ConsumerState<EpubReaderScreen> {
  int _index = 0;
  double _size = 17;
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _go(int i, int max) {
    setState(() => _index = i.clamp(0, max));
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_epubProvider(widget.bookId));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Leitura'),
        actions: [
          IconButton(
              tooltip: 'Diminuir fonte',
              onPressed: () =>
                  setState(() => _size = (_size - 1).clamp(12, 30)),
              icon: const Icon(Icons.text_decrease)),
          IconButton(
              tooltip: 'Aumentar fonte',
              onPressed: () =>
                  setState(() => _size = (_size + 1).clamp(12, 30)),
              icon: const Icon(Icons.text_increase)),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
                'Não foi possível abrir o arquivo. Só EPUB é suportado no app.\n$e',
                textAlign: TextAlign.center),
          ),
        ),
        data: (chapters) {
          if (chapters.isEmpty) {
            return const Center(child: Text('EPUB sem conteúdo legível.'));
          }
          final i = _index.clamp(0, chapters.length - 1);
          return Column(children: [
            Expanded(
              child: SingleChildScrollView(
                controller: _scroll,
                padding: const EdgeInsets.all(20),
                child: SelectableText(
                  chapters[i].text,
                  style: TextStyle(fontSize: _size, height: 1.6),
                ),
              ),
            ),
            SafeArea(
              child: Row(children: [
                IconButton(
                    onPressed:
                        i == 0 ? null : () => _go(i - 1, chapters.length - 1),
                    icon: const Icon(Icons.chevron_left)),
                Expanded(
                  child: Text('${i + 1} / ${chapters.length}',
                      textAlign: TextAlign.center),
                ),
                IconButton(
                    onPressed: i >= chapters.length - 1
                        ? null
                        : () => _go(i + 1, chapters.length - 1),
                    icon: const Icon(Icons.chevron_right)),
              ]),
            ),
          ]);
        },
      ),
    );
  }
}
