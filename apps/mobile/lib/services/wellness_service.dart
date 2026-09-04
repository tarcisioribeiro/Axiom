import 'package:dio/dio.dart';

import '../models/wellness.dart';
import 'api_client.dart';
import 'base_service.dart';

/// `personal-planning/wellness/*` — the "Wellness Center". Mostly plain
/// list/create endpoints; the weekly report and crisis log trigger LLM
/// calls server-side so those get a longer receive timeout.
class WellnessService {
  final ApiClient client;

  WellnessService(this.client);

  static const _base = '/api/v1/personal-planning/wellness/';

  Future<WellnessDashboard> dashboard() async {
    final r = await client.dio.get<Map<String, dynamic>>('${_base}dashboard/');
    _throw(r);
    return WellnessDashboard.fromJson(r.data!);
  }

  Future<List<EmotionalCheckin>> checkins({int days = 30}) =>
      _list('${_base}checkins/', EmotionalCheckin.fromJson,
          query: {'days': days});

  Future<void> createCheckin(EmotionalCheckin checkin) =>
      _post('${_base}checkins/', checkin.toJson());

  Future<List<CrisisImpulseLog>> crisisLogs() =>
      _list('${_base}crisis/', CrisisImpulseLog.fromJson);

  /// Creating a crisis log triggers an LLM empathy/action-plan response.
  Future<CrisisImpulseLog> createCrisisLog({
    required String emotionalState,
    String? emotionalStateOther,
    required String impulseType,
    String? impulseTypeOther,
  }) async {
    final r = await client.dio.post<Map<String, dynamic>>(
      '${_base}crisis/',
      data: {
        'emotional_state': emotionalState,
        if (emotionalStateOther != null && emotionalStateOther.isNotEmpty)
          'emotional_state_other': emotionalStateOther,
        'impulse_type': impulseType,
        if (impulseTypeOther != null && impulseTypeOther.isNotEmpty)
          'impulse_type_other': impulseTypeOther,
      },
      options: Options(receiveTimeout: const Duration(seconds: 120)),
    );
    _throw(r);
    return CrisisImpulseLog.fromJson(r.data!);
  }

  Future<void> resolveCrisis(int id) async {
    final r = await client.dio
        .patch<Map<String, dynamic>>('${_base}crisis/$id/resolve/');
    _throw(r);
  }

  Future<List<WellnessIntervention>> interventions() =>
      _list('${_base}interventions/', WellnessIntervention.fromJson);

  Future<void> completeIntervention(int interventionId,
      {int? rating, String? notes}) {
    return _post('${_base}intervention-completions/', {
      'intervention': interventionId,
      'completed_at': DateTime.now().toIso8601String(),
      if (rating != null) 'rating': rating,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  Future<List<WellnessWeeklyReport>> weeklyReports() =>
      _list('${_base}weekly-reports/', WellnessWeeklyReport.fromJson);

  Future<WellnessWeeklyReport> generateWeeklyReport() async {
    final r = await client.dio.post<Map<String, dynamic>>(
      '${_base}weekly-reports/generate/',
      options: Options(receiveTimeout: const Duration(seconds: 180)),
    );
    _throw(r);
    return WellnessWeeklyReport.fromJson(r.data!);
  }

  // --- helpers -------------------------------------------------------------

  Future<List<T>> _list<T>(
    String path,
    T Function(Map<String, dynamic>) fromJson, {
    Map<String, dynamic>? query,
  }) async {
    final r = await client.dio.get<dynamic>(path, queryParameters: query);
    _throw(r);
    final body = r.data;
    final results =
        body is Map ? (body['results'] as List? ?? const []) : body as List;
    return results.map((e) => fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> _post(String path, Map<String, dynamic> data) async {
    final r = await client.dio.post<Map<String, dynamic>>(path, data: data);
    _throw(r);
  }

  void _throw(Response r) {
    if ((r.statusCode ?? 0) >= 400) {
      throw ApiException(r.statusCode, r.data);
    }
  }
}
