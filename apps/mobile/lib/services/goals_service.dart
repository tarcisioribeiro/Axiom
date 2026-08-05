import '../models/goal.dart';
import 'base_service.dart';

class GoalsService extends BaseService<Goal> {
  GoalsService(super.client)
      : super(
          resourcePath: '/api/v1/personal-planning/goals/',
          fromJson: Goal.fromJson,
          toJson: (goal) => goal.toJson(),
        );
}
