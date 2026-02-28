import { API_CONFIG } from '@/config/constants';
import type {
  CreditCardInstallment,
  CreditCardInstallmentUpdateData,
  PaginatedResponse,
} from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

interface InstallmentFilters {
  purchase__card?: number;
  bill?: number | null;
  purchase__category?: string;
  payed?: boolean;
}

class CreditCardInstallmentsService extends BaseService<
  CreditCardInstallment,
  Partial<CreditCardInstallment>,
  CreditCardInstallmentUpdateData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.CREDIT_CARD_INSTALLMENTS);
  }

  /**
   * Busca todas as parcelas, lidando com paginação automaticamente.
   * Busca todas as páginas e concatena os resultados.
   */
  async getAll(params?: InstallmentFilters): Promise<CreditCardInstallment[]> {
    const allResults: CreditCardInstallment[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await apiClient.get<PaginatedResponse<CreditCardInstallment>>(
        this.endpoint,
        { ...params, page } as Record<string, unknown>
      );

      allResults.push(...response.results);
      hasMore = response.next !== null;
      page++;
    }

    return allResults;
  }

  async update(
    id: number,
    data: CreditCardInstallmentUpdateData
  ): Promise<CreditCardInstallment> {
    return apiClient.patch<CreditCardInstallment>(`${this.endpoint}${id}/`, data);
  }

  async getByCard(cardId: number): Promise<CreditCardInstallment[]> {
    return this.getAll({ purchase__card: cardId });
  }

  async getByBill(billId: number): Promise<CreditCardInstallment[]> {
    return this.getAll({ bill: billId });
  }

  async getUnassigned(): Promise<CreditCardInstallment[]> {
    return this.getAll({ bill: null });
  }

  async getUnpaid(): Promise<CreditCardInstallment[]> {
    return this.getAll({ payed: false });
  }

  async getPaid(): Promise<CreditCardInstallment[]> {
    return this.getAll({ payed: true });
  }

  async markAsPaid(id: number): Promise<CreditCardInstallment> {
    return this.update(id, { payed: true });
  }

  async assignToBill(id: number, billId: number): Promise<CreditCardInstallment> {
    return this.update(id, { bill: billId });
  }
}

export const creditCardInstallmentsService = new CreditCardInstallmentsService();
