import { API_CONFIG } from '@/config/api-config';
import type {
  Receivable,
  ReceivableFormData,
  ReceivableInstallment,
  ReceivableReceiptRequest,
} from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class ReceivablesService extends BaseService<Receivable, ReceivableFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.RECEIVABLES);
  }

  async getInstallments(receivableId: number): Promise<ReceivableInstallment[]> {
    return apiClient.get<ReceivableInstallment[]>(
      API_CONFIG.ENDPOINTS.RECEIVABLE_INSTALLMENTS(receivableId)
    );
  }

  async receive(
    receivableId: number,
    data: ReceivableReceiptRequest
  ): Promise<unknown> {
    return apiClient.post(API_CONFIG.ENDPOINTS.RECEIVABLE_RECEIPT(receivableId), data);
  }
}

export const receivablesService = new ReceivablesService();
