import '../utils/formatters.dart';

int? _int(dynamic v) => v == null ? null : AppFormatters.toDouble(v).toInt();

class Author {
  final String uuid;
  final int id;
  final String name;
  const Author({this.uuid = '', required this.id, required this.name});

  factory Author.fromJson(Map<String, dynamic> j) => Author(
      uuid: j['uuid'] as String? ?? '',
      id: j['id'] as int,
      name: j['name'] as String? ?? '');

  Map<String, dynamic> toJson() => {'name': name};
}

/// Subconjunto de `BookSerializer` usado no mobile. Capa/arquivo/leitor
/// EPUB continuam exclusivos do web.
class Book {
  final String uuid;
  final int id;
  final String title;
  final List<int> authors;
  final List<String> authorsNames;
  final int pages;
  final String language;
  final String? genre;
  final String? literarytype;
  final String? mediaType;
  final int? rating;
  final String readStatus;
  final double readingProgress;
  final int totalPagesRead;
  final bool hasCover;
  final bool hasFile;

  const Book({
    this.uuid = '',
    required this.id,
    required this.title,
    required this.authors,
    required this.authorsNames,
    required this.pages,
    required this.language,
    required this.readStatus,
    required this.readingProgress,
    required this.totalPagesRead,
    this.hasCover = false,
    this.hasFile = false,
    this.genre,
    this.literarytype,
    this.mediaType,
    this.rating,
  });

  factory Book.fromJson(Map<String, dynamic> j) => Book(
        uuid: j['uuid'] as String? ?? '',
        id: j['id'] as int,
        title: j['title'] as String? ?? '',
        authors: ((j['authors'] as List?) ?? const []).cast<int>(),
        authorsNames:
            ((j['authors_names'] as List?) ?? const []).cast<String>(),
        pages: _int(j['pages']) ?? 1,
        language: j['language'] as String? ?? 'Por',
        genre: j['genre'] as String?,
        literarytype: j['literarytype'] as String?,
        mediaType: j['media_type'] as String?,
        rating: _int(j['rating']),
        readStatus: j['read_status'] as String? ?? 'to_read',
        readingProgress: AppFormatters.toDouble(j['reading_progress']),
        totalPagesRead: _int(j['total_pages_read']) ?? 0,
        hasCover: j['cover'] != null,
        hasFile: j['book_file'] != null,
      );

  /// 0..1 — a API devolve porcentagem (0..100).
  double get progress => (readingProgress / 100).clamp(0, 1);
}

class Course {
  final String uuid;
  final int id;
  final String title;
  final String platform;
  final String category;
  final String? description;
  final String? url;
  final double? estimatedHours;
  final String status;
  final int totalLessons;
  final int completedLessons;
  final double progressPercentage;
  final double investedHours;

  const Course({
    this.uuid = '',
    required this.id,
    required this.title,
    required this.platform,
    required this.category,
    required this.status,
    required this.totalLessons,
    required this.completedLessons,
    required this.progressPercentage,
    required this.investedHours,
    this.description,
    this.url,
    this.estimatedHours,
  });

  factory Course.fromJson(Map<String, dynamic> j) => Course(
        uuid: j['uuid'] as String? ?? '',
        id: j['id'] as int,
        title: j['title'] as String? ?? '',
        platform: j['platform'] as String? ?? 'other',
        category: j['category'] as String? ?? 'technology',
        description: j['description'] as String?,
        url: j['url'] as String?,
        estimatedHours: j['estimated_hours'] == null
            ? null
            : AppFormatters.toDouble(j['estimated_hours']),
        status: j['status'] as String? ?? 'not_started',
        totalLessons: _int(j['total_lessons']) ?? 0,
        completedLessons: _int(j['completed_lessons']) ?? 0,
        progressPercentage: AppFormatters.toDouble(j['progress_percentage']),
        investedHours: AppFormatters.toDouble(j['invested_hours']),
      );

  double get progress => (progressPercentage / 100).clamp(0, 1);
}

class FlashCard {
  final int id;
  final String? bookTitle;
  final String front;
  final String back;
  final String status;
  final int intervalDays;
  final DateTime? nextReview;

  const FlashCard({
    required this.id,
    required this.front,
    required this.back,
    required this.status,
    required this.intervalDays,
    this.bookTitle,
    this.nextReview,
  });

  factory FlashCard.fromJson(Map<String, dynamic> j) => FlashCard(
        id: j['id'] as int,
        bookTitle: j['book_title'] as String?,
        front: j['front'] as String? ?? '',
        back: j['back'] as String? ?? '',
        status: j['status'] as String? ?? 'new',
        intervalDays: _int(j['interval_days']) ?? 0,
        nextReview: AppFormatters.parseApiDate(j['next_review'] as String?),
      );
}

class Skill {
  final String uuid;
  final int id;
  final String name;
  final String category;
  final String proficiency;
  final int proficiencyLevel;
  final String status;
  final String? notes;

  const Skill({
    this.uuid = '',
    required this.id,
    required this.name,
    required this.category,
    required this.proficiency,
    required this.proficiencyLevel,
    required this.status,
    this.notes,
  });

  factory Skill.fromJson(Map<String, dynamic> j) => Skill(
        uuid: j['uuid'] as String? ?? '',
        id: j['id'] as int,
        name: j['name'] as String? ?? '',
        category: j['category'] as String? ?? 'technology',
        proficiency: j['proficiency'] as String? ?? 'beginner',
        proficiencyLevel: _int(j['proficiency_level']) ?? 1,
        status: j['status'] as String? ?? 'learning',
        notes: j['notes'] as String?,
      );
}

class CourseLesson {
  final int id;
  final String title;
  final int order;
  final bool isCompleted;
  const CourseLesson({
    required this.id,
    required this.title,
    required this.order,
    required this.isCompleted,
  });

  factory CourseLesson.fromJson(Map<String, dynamic> j) => CourseLesson(
        id: j['id'] as int,
        title: j['title'] as String? ?? '',
        order: _int(j['order']) ?? 0,
        isCompleted: j['is_completed'] as bool? ?? false,
      );
}

class CourseModule {
  final int id;
  final String title;
  final int order;
  final List<CourseLesson> lessons;
  const CourseModule({
    required this.id,
    required this.title,
    required this.order,
    required this.lessons,
  });

  factory CourseModule.fromJson(Map<String, dynamic> j) => CourseModule(
        id: j['id'] as int,
        title: j['title'] as String? ?? '',
        order: _int(j['order']) ?? 0,
        lessons: ((j['lessons'] as List?) ?? const [])
            .map((e) => CourseLesson.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class Highlight {
  final int id;
  final int book;
  final String text;
  final int? pageNumber;
  final String? chapter;
  final String type;
  final String color;
  const Highlight({
    required this.id,
    required this.book,
    required this.text,
    required this.type,
    required this.color,
    this.pageNumber,
    this.chapter,
  });

  factory Highlight.fromJson(Map<String, dynamic> j) => Highlight(
        id: j['id'] as int,
        book: j['book'] as int,
        text: j['text'] as String? ?? '',
        pageNumber: _int(j['page_number']),
        chapter: j['chapter'] as String?,
        type: j['highlight_type'] as String? ?? 'quote',
        color: j['color'] as String? ?? 'yellow',
      );
}

/// Vínculo manual do grafo de conhecimento; `sourceId`/`targetId` são UUIDs.
class KnowledgeLink {
  final int id;
  final String sourceType;
  final String sourceId;
  final String targetType;
  final String targetId;
  final String relation;
  const KnowledgeLink({
    required this.id,
    required this.sourceType,
    required this.sourceId,
    required this.targetType,
    required this.targetId,
    required this.relation,
  });

  factory KnowledgeLink.fromJson(Map<String, dynamic> j) => KnowledgeLink(
        id: j['id'] as int,
        sourceType: j['source_type'] as String? ?? '',
        sourceId: j['source_id'] as String? ?? '',
        targetType: j['target_type'] as String? ?? '',
        targetId: j['target_id'] as String? ?? '',
        relation: j['relation_label'] as String? ?? 'relates',
      );
}
