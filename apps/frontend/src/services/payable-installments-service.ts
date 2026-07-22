import { API_CONFIG } from '@/config/api-config';
import type { PayableInstallment, PayablePaymentRequest } from '@/types';

import { apiClient } from './api-client';

class PayableInstallmentsService {
  async getByPayable(payableId: number): Promise<PayableInstallment[]> {
    return apiClient.get<PayableInstallment[]>(
      API_CONFIG.ENDPOINTS.PAYABLE_INSTALLMENTS(payableId)
    );
  }

  async markPaid(
    payableId: number,
    installmentNumber: number
  ): Promise<PayableInstallment> {
    return apiClient.patch<PayableInstallment>(
      API_CONFIG.ENDPOINTS.PAYABLE_INSTALLMENTS(payableId),
      { installment_number: installmentNumber, payed: true }
    );
  }

  async pay(payableId: number, data: PayablePaymentRequest): Promise<unknown> {
    return apiClient.post(API_CONFIG.ENDPOINTS.PAYABLE_PAYMENT(payableId), data);
  }
}

export const payableInstallmentsService = new PayableInstallmentsService();
