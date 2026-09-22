import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/library.dart';
import '../services/library_services.dart';
import 'core_providers.dart';

final authorsServiceProvider =
    Provider((ref) => AuthorsService(ref.watch(apiClientProvider)));
final booksServiceProvider =
    Provider((ref) => BooksService(ref.watch(apiClientProvider)));
final readingsServiceProvider =
    Provider((ref) => ReadingsService(ref.watch(booksServiceProvider)));
final coursesServiceProvider =
    Provider((ref) => CoursesService(ref.watch(apiClientProvider)));
final skillsServiceProvider =
    Provider((ref) => SkillsService(ref.watch(apiClientProvider)));
final flashCardsServiceProvider =
    Provider((ref) => FlashCardsService(ref.watch(apiClientProvider)));

final authorsProvider = FutureProvider.autoDispose<List<Author>>(
  (ref) => ref.watch(authorsServiceProvider).getAll(),
);
final booksProvider = FutureProvider.autoDispose<List<Book>>(
  (ref) => ref.watch(booksServiceProvider).getAll(),
);
final coursesProvider = FutureProvider.autoDispose<List<Course>>(
  (ref) => ref.watch(coursesServiceProvider).getAll(),
);
final skillsProvider = FutureProvider.autoDispose<List<Skill>>(
  (ref) => ref.watch(skillsServiceProvider).getAll(),
);
final dueFlashCardsProvider = FutureProvider.autoDispose<List<FlashCard>>(
  (ref) => ref.watch(flashCardsServiceProvider).getAll(query: {'due': 'true'}),
);

final courseModulesServiceProvider =
    Provider((ref) => CourseModulesService(ref.watch(apiClientProvider)));
final courseLessonsServiceProvider =
    Provider((ref) => CourseLessonsService(ref.watch(apiClientProvider)));
final highlightsServiceProvider =
    Provider((ref) => HighlightsService(ref.watch(apiClientProvider)));
final knowledgeLinksServiceProvider =
    Provider((ref) => KnowledgeLinksService(ref.watch(apiClientProvider)));

final courseModulesProvider =
    FutureProvider.autoDispose.family<List<CourseModule>, int>(
  (ref, courseId) => ref
      .watch(courseModulesServiceProvider)
      .getAll(query: {'course': courseId}),
);
final bookHighlightsProvider =
    FutureProvider.autoDispose.family<List<Highlight>, int>(
  (ref, bookId) =>
      ref.watch(highlightsServiceProvider).getAll(query: {'book': bookId}),
);
final allFlashCardsProvider = FutureProvider.autoDispose<List<FlashCard>>(
  (ref) => ref.watch(flashCardsServiceProvider).getAll(),
);
final knowledgeLinksProvider = FutureProvider.autoDispose<List<KnowledgeLink>>(
  (ref) => ref.watch(knowledgeLinksServiceProvider).getAll(),
);

final libraryImportServiceProvider =
    Provider((ref) => LibraryImportService(ref.watch(booksServiceProvider)));

/// Bytes da capa (null quando o livro não tem ou falha) — cache por livro.
final bookCoverProvider = FutureProvider.autoDispose.family<Uint8List?, int>(
  (ref, id) async {
    ref.keepAlive();
    try {
      return await ref.watch(booksServiceProvider).cover(id);
    } catch (_) {
      return null;
    }
  },
);

final knowledgeGraphProvider = FutureProvider.autoDispose<Map<String, dynamic>>(
  (ref) => ref.watch(libraryImportServiceProvider).graph(),
);
