import 'dart:convert';

import 'package:dio/dio.dart';

import '../models/chat_message.dart';
import 'api_client.dart';
import 'base_service.dart';

/// One parsed `data: {...}` SSE event from `agents/stream/` — either an
/// incremental token or the final event carrying the full metadata
/// (`sources`, `query_id`, etc., mirroring `useAgentStream` on the web app).
class AgentStreamEvent {
  final String? token;
  final bool done;
  final String? sources;

  const AgentStreamEvent({this.token, this.done = false, this.sources});
}

/// Wraps `/api/v1/agents/*`. `stream/` is Server-Sent Events, which Dio
/// doesn't parse natively — `ResponseType.stream` gets the raw byte stream
/// and the `data: {...}\n\n` framing is parsed by hand below.
class AgentsService {
  final ApiClient client;

  AgentsService(this.client);

  static const _basePath = '/api/v1/agents/';

  Future<Map<String, dynamic>> status() async {
    final response =
        await client.dio.get<Map<String, dynamic>>('${_basePath}status/');
    return response.data ?? const {};
  }

  Future<String> createSession() async {
    final response =
        await client.dio.post<Map<String, dynamic>>('${_basePath}sessions/');
    return response.data?['session_id'] as String? ?? '';
  }

  Future<List<ChatMessage>> history(String sessionId) async {
    final response = await client.dio.get<Map<String, dynamic>>(
      '${_basePath}history/',
      queryParameters: {'session_id': sessionId},
    );
    final results = response.data?['results'] as List<dynamic>? ?? const [];
    return results
        .map((e) => ChatMessage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> clearHistory(String sessionId) async {
    await client.dio.delete(
      '${_basePath}history/',
      queryParameters: {'session_id': sessionId},
    );
  }

  Stream<AgentStreamEvent> streamAsk({
    required String query,
    required String sessionId,
    String? agentName,
  }) async* {
    final response = await client.dio.post<ResponseBody>(
      '${_basePath}stream/',
      data: {
        'query': query,
        'session_id': sessionId,
        if (agentName != null) 'agent_name': agentName,
      },
      options: Options(responseType: ResponseType.stream),
    );

    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, 'Falha ao consultar o agente.');
    }

    var buffer = '';
    await for (final chunk in response.data!.stream) {
      buffer += utf8.decode(chunk, allowMalformed: true);
      while (buffer.contains('\n\n')) {
        final splitAt = buffer.indexOf('\n\n');
        final rawEvent = buffer.substring(0, splitAt).trim();
        buffer = buffer.substring(splitAt + 2);
        if (!rawEvent.startsWith('data:')) continue;

        final jsonStr = rawEvent.substring(5).trim();
        if (jsonStr.isEmpty) continue;
        Map<String, dynamic> payload;
        try {
          payload = jsonDecode(jsonStr) as Map<String, dynamic>;
        } catch (_) {
          continue;
        }

        if (payload['done'] == true) {
          yield AgentStreamEvent(
            done: true,
            sources: (payload['sources'] as List<dynamic>?)?.join(', '),
          );
        } else if (payload['token'] != null) {
          yield AgentStreamEvent(token: payload['token'] as String);
        }
      }
    }
  }
}
