import '../models/workout_session.dart';
import 'base_service.dart';

class WorkoutSessionsService extends BaseService<WorkoutSession> {
  WorkoutSessionsService(super.client)
      : super(
          resourcePath: '/api/v1/personal-planning/workout-sessions/',
          fromJson: WorkoutSession.fromJson,
          toJson: (session) => session.toJson(),
        );
}
