import { API_CONFIG } from '@/config/constants';
import type { CreditCard, CreditCardFormData } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class CreditCardsService extends BaseService<CreditCard, CreditCardFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.CREDIT_CARDS);
  }

  /** Exclusão (soft delete) exige o número completo e o CVV do cartão. */
  async deleteWithCredentials(
    id: number,
    credentials: { card_number: string; security_code: string }
  ): Promise<void> {
    return apiClient.delete(`${this.endpoint}${id}/`, credentials);
  }
}

export const creditCardsService = new CreditCardsService();
