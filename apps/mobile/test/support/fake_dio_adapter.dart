import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// Minimal [HttpClientAdapter] fake for widget tests that exercise a real
/// screen + Riverpod provider tree against canned JSON, instead of hitting
/// the network. Swap it onto an `ApiClient.inMemory(...)`'s `dio` via
/// `client.dio.httpClientAdapter = FakeHttpClientAdapter(handler)`.
class FakeHttpClientAdapter implements HttpClientAdapter {
  final ResponseBody Function(RequestOptions options) handler;

  FakeHttpClientAdapter(this.handler);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody jsonResponseBody(dynamic data, {int statusCode = 200}) {
  final bytes = utf8.encode(jsonEncode(data));
  return ResponseBody.fromBytes(
    bytes,
    statusCode,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

/// `{count, next, previous, results}` envelope, matching every
/// `BaseListCreateView`-backed endpoint (see `services/base_service.dart`).
Map<String, dynamic> paginatedBody(List<dynamic> results) => {
      'count': results.length,
      'next': null,
      'previous': null,
      'results': results,
    };
