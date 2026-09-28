import 'package:dio/dio.dart';

import '../models/hydration.dart';
import '../utils/formatters.dart';
import 'api_client.dart';
import 'base_service.dart';

/// Meta de hidratação (`hydration-goal/`, recurso único por membro) e
/// registros de água (`water-logs/`). Registrar água conclui as ocorrências
/// das tarefas vinculadas à meta — a sincronização é feita no backend.
class HydrationService {
  final ApiClient client;

  HydrationService(this.client);

  static const _base = '/api/v1/personal-planning/';

  Dio get _dio => client.dio;

  void _check(Response response) {
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode, response.data);
    }
  }

  Future<HydrationGoal> goal() async {
    final r = await _dio.get<Map<String, dynamic>>('${_base}hydration-goal/');
    _check(r);
    return HydrationGoal.fromJson(r.data!);
  }

  Future<HydrationGoal> saveGoal(int dailyTargetMl) async {
    final r = await _dio.put<Map<String, dynamic>>(
      '${_base}hydration-goal/',
      data: {'daily_target_ml': dailyTargetMl},
    );
    _check(r);
    return HydrationGoal.fromJson(r.data!);
  }

  Future<HydrationSuggestion> suggestion() async {
    final r = await _dio
        .get<Map<String, dynamic>>('${_base}hydration-goal/suggestion/');
    _check(r);
    return HydrationSuggestion.fromJson(r.data!);
  }

  Future<List<WaterLog>> waterLogs(DateTime date) async {
    final r = await _dio.get<Map<String, dynamic>>(
      '${_base}water-logs/',
      queryParameters: {'date': AppFormatters.apiDate(date)},
    );
    _check(r);
    return (r.data!['results'] as List)
        .map((e) => WaterLog.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> addWater(DateTime date, int amountMl, {String? time}) async {
    final r = await _dio.post<Map<String, dynamic>>(
      '${_base}water-logs/',
      data: {
        'date': AppFormatters.apiDate(date),
        'amount_ml': amountMl,
        if (time != null) 'time': time,
      },
    );
    _check(r);
  }

  Future<void> deleteWater(int id) async {
    final r = await _dio.delete('${_base}water-logs/$id/');
    _check(r);
  }
}
