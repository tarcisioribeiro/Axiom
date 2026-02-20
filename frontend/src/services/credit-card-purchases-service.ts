import { API_CONFIG } from '@/config/constants';
import type {
  CreditCardPurchase,
  CreditCardPurchaseFormData,
  PaginatedResponse,
} from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class CreditCardPurchasesService extends BaseService<CreditCardPurchase, CreditCardPurchaseFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.CREDIT_CARD_PURCHASES);
  }

  /**
   * Busca todas as compras, lidando com paginação automaticamente.
   * Busca todas as páginas e concatena os resultados.
   */
  async getAll(params?: Record<string, unknown>): Promise<CreditCardPurchase[]> {
    const allResults: CreditCardPurchase[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await apiClient.get<PaginatedResponse<CreditCardPurchase>>(
        this.endpoint,
        { ...params, page }
      );

      allResults.push(...response.results);
      hasMore = response.next !== null;
      page++;
    }

    return allResults;
  }

  async update(id: number, data: Partial<CreditCardPurchaseFormData>): Promise<CreditCardPurchase> {
    return apiClient.patch<CreditCardPurchase>(`${this.endpoint}${id}/`, data);
  }

  async getByCard(cardId: number): Promise<CreditCardPurchase[]> {
    return this.getAll({ card: cardId });
  }

  async getByCategory(category: string): Promise<CreditCardPurchase[]> {
    return this.getAll({ category });
  }
}

export const creditCardPurchasesService = new CreditCardPurchasesService();
