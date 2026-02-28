import { API_CONFIG } from '@/config/constants';
import type {
  StoredCreditCard,
  StoredCreditCardFormData,
  StoredCreditCardReveal,
} from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class StoredCardsService extends BaseService<
  StoredCreditCard,
  StoredCreditCardFormData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.STORED_CARDS);
  }

  async reveal(id: number): Promise<StoredCreditCardReveal> {
    return apiClient.get<StoredCreditCardReveal>(`${this.endpoint}${id}/reveal/`);
  }
}

export const storedCardsService = new StoredCardsService();
