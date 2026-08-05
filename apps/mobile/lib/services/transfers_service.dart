import '../models/transfer.dart';
import 'base_service.dart';

class TransfersService extends BaseService<Transfer> {
  TransfersService(super.client)
      : super(
          resourcePath: '/api/v1/transfers/',
          fromJson: Transfer.fromJson,
          toJson: (transfer) => transfer.toJson(),
        );
}
