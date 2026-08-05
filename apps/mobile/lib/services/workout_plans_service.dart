import '../models/workout_plan.dart';
import 'base_service.dart';

class WorkoutPlansService extends BaseService<WorkoutPlan> {
  WorkoutPlansService(super.client)
      : super(
          resourcePath: '/api/v1/personal-planning/workout-plans/',
          fromJson: WorkoutPlan.fromJson,
          toJson: (plan) => plan.toJson(),
        );
}
