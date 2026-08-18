import '../models/credit_card_purchase.dart';
import 'base_service.dart';

class CreditCardPurchasesService extends BaseService<CreditCardPurchase> {
  CreditCardPurchasesService(super.client)
      : super(
          resourcePath: '/api/v1/credit-cards-purchases/',
          fromJson: CreditCardPurchase.fromJson,
          toJson: (purchase) => purchase.toJson(),
        );
}
