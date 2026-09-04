import '../models/workout_exercise.dart';
import 'base_service.dart';

class WorkoutExercisesService extends BaseService<WorkoutExercise> {
  WorkoutExercisesService(super.client)
      : super(
          resourcePath: '/api/v1/personal-planning/workout-exercises/',
          fromJson: WorkoutExercise.fromJson,
          toJson: (e) => e.toJson(),
        );
}
