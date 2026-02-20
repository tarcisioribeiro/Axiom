import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type { CreditCard, CreditCardFormData } from '@/types';

class CreditCardsService extends BaseService<CreditCard, CreditCardFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.CREDIT_CARDS);
  }
}

export const creditCardsService = new CreditCardsService();
