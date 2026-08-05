import '../models/exercise_catalog.dart';
import 'base_service.dart';

class ExerciseCatalogService extends BaseService<ExerciseCatalog> {
  ExerciseCatalogService(super.client)
      : super(
          resourcePath: '/api/v1/personal-planning/exercises/',
          fromJson: ExerciseCatalog.fromJson,
          toJson: (exercise) => exercise.toJson(),
        );
}
