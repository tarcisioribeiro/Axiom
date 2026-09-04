import '../models/workout_day.dart';
import 'base_service.dart';

class WorkoutDaysService extends BaseService<WorkoutDay> {
  WorkoutDaysService(super.client)
      : super(
          resourcePath: '/api/v1/personal-planning/workout-days/',
          fromJson: WorkoutDay.fromJson,
          toJson: (d) => d.toJson(),
        );
}
