import 'package:dio/dio.dart';

import '../models/paginated_response.dart';
import 'api_client.dart';

/// Thrown by [BaseService] methods when the API responds with a 4xx/5xx
/// status. [errors] holds the raw decoded error body (DRF field-error map,
/// `{"detail": "..."}`, etc.) so screens can surface field-level validation
/// messages the same way the web app's `ValidationError.errors` does.
class ApiException implements Exception {
  final int? statusCode;
  final dynamic errors;

  const ApiException(this.statusCode, this.errors);

  String get message {
    if (errors is Map && errors['detail'] is String) {
      return errors['detail'] as String;
    }
    if (errors is String) return errors as String;
    return 'Erro inesperado ao comunicar com o servidor.';
  }

  @override
  String toString() => 'ApiException($statusCode, $errors)';
}

/// Generic CRUD helper for DRF's `BaseListCreateView` /
/// `BaseRetrieveUpdateDestroyView` pattern, mirroring
/// `services/base-service.ts` on the web app. Domain services extend this
/// for the ~15 resources that are plain CRUD and add extra methods for
/// resource-specific actions (pay/reveal/renegotiate/etc.) directly.
class BaseService<T> {
  final ApiClient client;
  final String resourcePath;
  final T Function(Map<String, dynamic>) fromJson;
  final Map<String, dynamic> Function(T) toJson;

  BaseService(
    this.client, {
    required this.resourcePath,
    required this.fromJson,
    required this.toJson,
  });

  Dio get _dio => client.dio;

  Future<PaginatedResponse<T>> getAllPaginated({
    Map<String, dynamic>? query,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      resourcePath,
      queryParameters: query,
    );
    _throwIfError(response);
    return PaginatedResponse.fromJson(response.data!, fromJson);
  }

  /// Fetches every page and flattens the results — convenient for small
  /// resources shown as a single scroll (accounts, credit cards) where
  /// manual pagination UI isn't worth the complexity. The first page tells
  /// us the total count, so remaining pages are fetched concurrently
  /// instead of one-by-one — cuts wall-clock time roughly by the page count
  /// for resources with more than one page.
  Future<List<T>> getAll({Map<String, dynamic>? query}) async {
    final first = await getAllPaginated(query: {...?query, 'page': 1});
    if (!first.hasNext) return first.results;

    final pageSize = first.results.length;
    if (pageSize == 0) return first.results;
    final totalPages = (first.count / pageSize).ceil();

    final rest = await Future.wait([
      for (var page = 2; page <= totalPages; page++)
        getAllPaginated(query: {...?query, 'page': page}),
    ]);

    return [first.results, for (final r in rest) r.results]
        .expand((results) => results)
        .toList();
  }

  Future<T> getById(dynamic id) async {
    final response = await _dio.get<Map<String, dynamic>>('$resourcePath$id/');
    _throwIfError(response);
    return fromJson(response.data!);
  }

  Future<T> create(Map<String, dynamic> data) async {
    final response = await _dio.post<Map<String, dynamic>>(
      resourcePath,
      data: data,
    );
    _throwIfError(response);
    return fromJson(response.data!);
  }

  Future<T> update(dynamic id, Map<String, dynamic> data) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '$resourcePath$id/',
      data: data,
    );
    _throwIfError(response);
    return fromJson(response.data!);
  }

  Future<T> patch(dynamic id, Map<String, dynamic> data) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '$resourcePath$id/',
      data: data,
    );
    _throwIfError(response);
    return fromJson(response.data!);
  }

  Future<void> delete(dynamic id) async {
    final response = await _dio.delete('$resourcePath$id/');
    _throwIfError(response);
  }

  void _throwIfError(Response response) {
    final status = response.statusCode ?? 0;
    if (status >= 200 && status < 300) return;
    throw ApiException(status, response.data);
  }
}
