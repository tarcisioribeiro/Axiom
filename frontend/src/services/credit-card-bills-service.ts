import { API_CONFIG } from '@/config/constants';
import type { CreditCardBill, CreditCardBillFormData, BillPaymentFormData, BillPaymentResponse, BillItemsResponse } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class CreditCardBillsService extends BaseService<CreditCardBill, CreditCardBillFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.CREDIT_CARD_BILLS);
  }

  async getByCard(cardId: number): Promise<CreditCardBill[]> {
    return this.getAll({ credit_card: cardId });
  }

  async getByStatus(
    status: 'open' | 'closed' | 'paid' | 'overdue'
  ): Promise<CreditCardBill[]> {
    return this.getAll({ status });
  }

  async getByYear(year: string): Promise<CreditCardBill[]> {
    return this.getAll({ year });
  }

  async payBill(billId: number, data: BillPaymentFormData): Promise<BillPaymentResponse> {
    return apiClient.post<BillPaymentResponse>(`${this.endpoint}${billId}/pay/`, data);
  }

  async reopenBill(billId: number): Promise<{ message: string; bill: CreditCardBill }> {
    return apiClient.post<{ message: string; bill: CreditCardBill }>(`${this.endpoint}${billId}/reopen/`, {});
  }

  /**
   * Busca todos os itens de uma fatura (despesas legadas + parcelas).
   * Este método retorna uma lista unificada de todos os lançamentos da fatura,
   * incluindo despesas fixas (CreditCardExpense) e parcelas de compras (CreditCardInstallment).
   */
  async getBillItems(billId: number): Promise<BillItemsResponse> {
    return apiClient.get<BillItemsResponse>(`${this.endpoint}${billId}/items/`);
  }
}

export const creditCardBillsService = new CreditCardBillsService();
