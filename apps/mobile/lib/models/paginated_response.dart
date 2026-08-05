/// Envelope for DRF's `PageNumberPagination` responses
/// (`{count, next, previous, results}`), mirroring
/// `services/base-service.ts`'s `PaginatedResponse<T>` on the web app.
class PaginatedResponse<T> {
  final int count;
  final String? next;
  final String? previous;
  final List<T> results;

  const PaginatedResponse({
    required this.count,
    required this.results,
    this.next,
    this.previous,
  });

  bool get hasNext => next != null;

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJsonT,
  ) {
    final rawResults = (json['results'] as List<dynamic>? ?? const []);
    return PaginatedResponse<T>(
      count: json['count'] as int? ?? rawResults.length,
      next: json['next'] as String?,
      previous: json['previous'] as String?,
      results: rawResults
          .map((item) => fromJsonT(item as Map<String, dynamic>))
          .toList(),
    );
  }
}
