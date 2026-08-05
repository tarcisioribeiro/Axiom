import '../models/task_instance.dart';
import '../utils/formatters.dart';
import 'api_client.dart';

/// `instances/` isn't plain CRUD from the mobile app's point of view — the
/// checklist screen only ever reads "today's instances" and flips their
/// status, so this wraps the two custom endpoints directly instead of
/// extending [BaseService].
class TaskInstancesService {
  final ApiClient client;

  TaskInstancesService(this.client);

  static const _basePath = '/api/v1/personal-planning/instances/';

  Future<TaskInstancesForDate> forDate(DateTime date) async {
    final response = await client.dio.get<Map<String, dynamic>>(
      '$_basePath' 'for-date/',
      queryParameters: {'date': AppFormatters.apiDate(date), 'sync': true},
    );
    return TaskInstancesForDate.fromJson(response.data!);
  }

  Future<TaskInstance> updateStatus(int id, String status) async {
    final response = await client.dio.patch<Map<String, dynamic>>(
      '$_basePath$id/status/',
      data: {'status': status},
    );
    return TaskInstance.fromJson(response.data!);
  }
}
