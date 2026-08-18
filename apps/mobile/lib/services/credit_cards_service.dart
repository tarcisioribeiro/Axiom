import '../models/credit_card.dart';
import 'base_service.dart';

class CreditCardsService extends BaseService<CreditCard> {
  CreditCardsService(super.client)
      : super(
          resourcePath: '/api/v1/credit-cards/',
          fromJson: CreditCard.fromJson,
          toJson: (card) => card.toJson(),
        );
}
