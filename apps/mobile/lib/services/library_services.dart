import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../models/library.dart';
import 'base_service.dart';

class AuthorsService extends BaseService<Author> {
  AuthorsService(super.client)
      : super(
          resourcePath: '/api/v1/library/authors/',
          fromJson: Author.fromJson,
          toJson: (a) => a.toJson(),
        );
}

class BooksService extends BaseService<Book> {
  BooksService(super.client)
      : super(
          resourcePath: '/api/v1/library/books/',
          fromJson: Book.fromJson,
          toJson: (_) => const {},
        );

  Future<Uint8List> _bytes(String path) async {
    final r = await client.dio.get<List<int>>(path,
        options: Options(responseType: ResponseType.bytes));
    if ((r.statusCode ?? 0) >= 400) throw ApiException(r.statusCode, null);
    return Uint8List.fromList(r.data!);
  }

  /// A capa é um redirect autenticado (MinIO pré-assinado); o dio o segue.
  Future<Uint8List> cover(int id) => _bytes('$resourcePath$id/cover/');

  /// Stream do EPUB/PDF anexado, via proxy do Django.
  Future<Uint8List> file(int id) => _bytes('$resourcePath$id/file/stream/');

  Future<void> _upload(String path, String method, String field, String name,
      Uint8List bytes) async {
    final r = await client.dio.request<Map<String, dynamic>>(
      path,
      data: FormData.fromMap(
          {field: MultipartFile.fromBytes(bytes, filename: name)}),
      options: Options(method: method),
    );
    if ((r.statusCode ?? 0) >= 400) throw ApiException(r.statusCode, r.data);
  }

  Future<void> uploadCover(int id, String name, Uint8List bytes) =>
      _upload('$resourcePath$id/', 'PATCH', 'cover', name, bytes);

  Future<void> uploadFile(int id, String name, Uint8List bytes) =>
      _upload('$resourcePath$id/file/', 'PATCH', 'book_file', name, bytes);
}

/// Importações em lote (multipart, campo `file`); devolvem um resumo legível.
class LibraryImportService {
  final BooksService _books;
  const LibraryImportService(this._books);

  Future<Map<String, dynamic>> _post(
      String path, String name, Uint8List bytes) async {
    final r = await _books.client.dio.post<Map<String, dynamic>>(
      path,
      data: FormData.fromMap(
          {'file': MultipartFile.fromBytes(bytes, filename: name)}),
    );
    if ((r.statusCode ?? 0) >= 400) throw ApiException(r.statusCode, r.data);
    return r.data ?? const {};
  }

  Future<String> goodreads(String name, Uint8List bytes) async {
    final r = await _post('/api/v1/library/goodreads-import/', name, bytes);
    return '${r['imported']} livro(s) importado(s), ${r['skipped']} ignorado(s), '
        '${r['errors']} erro(s).';
  }

  Future<String> kindle(String name, Uint8List bytes) async {
    final r =
        await _post('/api/v1/library/highlights/kindle-import/', name, bytes);
    return '${r['total_imported']} destaque(s) importado(s), '
        '${r['total_skipped']} ignorado(s).';
  }

  /// Nós e arestas do grafo (`knowledge-graph/`).
  Future<Map<String, dynamic>> graph() async {
    final r = await _books.client.dio.get<Map<String, dynamic>>(
        '/api/v1/library/knowledge-graph/',
        queryParameters: {'include_highlights': 'false'});
    if ((r.statusCode ?? 0) >= 400) throw ApiException(r.statusCode, r.data);
    return r.data ?? const {};
  }
}

class ReadingsService {
  final BooksService _books;
  const ReadingsService(this._books);

  /// Registra uma sessão de leitura; o backend atualiza o status do livro.
  Future<void> log({
    required int bookId,
    required int ownerId,
    required String date,
    required int pagesRead,
    required int minutes,
  }) async {
    final r = await _books.client.dio.post<Map<String, dynamic>>(
      '/api/v1/library/readings/',
      data: {
        'book': bookId,
        'owner': ownerId,
        'reading_date': date,
        'pages_read': pagesRead,
        'reading_time': minutes,
      },
    );
    if ((r.statusCode ?? 0) >= 400) throw ApiException(r.statusCode, r.data);
  }
}

class CoursesService extends BaseService<Course> {
  CoursesService(super.client)
      : super(
          resourcePath: '/api/v1/library/courses/',
          fromJson: Course.fromJson,
          toJson: (_) => const {},
        );
}

class SkillsService extends BaseService<Skill> {
  SkillsService(super.client)
      : super(
          resourcePath: '/api/v1/library/skills/',
          fromJson: Skill.fromJson,
          toJson: (_) => const {},
        );
}

class FlashCardsService extends BaseService<FlashCard> {
  FlashCardsService(super.client)
      : super(
          resourcePath: '/api/v1/library/flashcards/',
          fromJson: FlashCard.fromJson,
          toJson: (_) => const {},
        );

  /// SM-2: [rating] 0..5 (0 = errei, 5 = fácil).
  Future<void> review(int id, int rating) async {
    final r = await client.dio.post<Map<String, dynamic>>(
      '$resourcePath$id/review/',
      data: {'rating': rating},
    );
    if ((r.statusCode ?? 0) >= 400) throw ApiException(r.statusCode, r.data);
  }
}

class CourseModulesService extends BaseService<CourseModule> {
  CourseModulesService(super.client)
      : super(
          resourcePath: '/api/v1/library/course-modules/',
          fromJson: CourseModule.fromJson,
          toJson: (_) => const {},
        );
}

class CourseLessonsService extends BaseService<CourseLesson> {
  CourseLessonsService(super.client)
      : super(
          resourcePath: '/api/v1/library/course-lessons/',
          fromJson: CourseLesson.fromJson,
          toJson: (_) => const {},
        );

  Future<void> toggle(int id) async {
    final r = await client.dio
        .patch<Map<String, dynamic>>('$resourcePath$id/toggle/');
    if ((r.statusCode ?? 0) >= 400) throw ApiException(r.statusCode, r.data);
  }
}

class HighlightsService extends BaseService<Highlight> {
  HighlightsService(super.client)
      : super(
          resourcePath: '/api/v1/library/highlights/',
          fromJson: Highlight.fromJson,
          toJson: (_) => const {},
        );

  /// Cria flashcards a partir dos destaques do livro; devolve quantos.
  Future<int> generateFlashcards(int bookId) async {
    final r = await client.dio.post<Map<String, dynamic>>(
        '/api/v1/library/books/$bookId/flashcards/generate/');
    if ((r.statusCode ?? 0) >= 400) throw ApiException(r.statusCode, r.data);
    return (r.data?['created'] as int?) ?? 0;
  }
}

class KnowledgeLinksService extends BaseService<KnowledgeLink> {
  KnowledgeLinksService(super.client)
      : super(
          resourcePath: '/api/v1/library/knowledge-links/',
          fromJson: KnowledgeLink.fromJson,
          toJson: (_) => const {},
        );
}
