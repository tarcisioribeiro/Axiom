import '../models/revenue.dart';
import 'base_service.dart';

class RevenuesService extends BaseService<Revenue> {
  RevenuesService(super.client)
      : super(
          resourcePath: '/api/v1/revenues/',
          fromJson: Revenue.fromJson,
          toJson: (revenue) => revenue.toJson(),
        );
}
