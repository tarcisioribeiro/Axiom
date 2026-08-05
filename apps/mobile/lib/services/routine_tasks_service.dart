import '../models/routine_task.dart';
import 'base_service.dart';

class RoutineTasksService extends BaseService<RoutineTask> {
  RoutineTasksService(super.client)
      : super(
          resourcePath: '/api/v1/personal-planning/routine-tasks/',
          fromJson: RoutineTask.fromJson,
          toJson: (task) => task.toJson(),
        );
}
