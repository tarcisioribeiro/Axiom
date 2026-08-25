import { API_CONFIG } from '@/config/api-config';
import type {
  PayableInstallment,
  PayablePaymentRequest,
  PaymentPlanRequest,
  PaymentPlanResponse,
  RecalculationResponse,
  RedistributeAfterPaymentRequest,
  RedistributeAfterPaymentResponse,
} from '@/types';

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

  async createPaymentPlan(
    payableId: number,
    data: PaymentPlanRequest
  ): Promise<PaymentPlanResponse> {
    return apiClient.post<PaymentPlanResponse>(
      API_CONFIG.ENDPOINTS.PAYABLE_PAYMENT_PLAN(payableId),
      data
    );
  }

  async increaseValue(
    payableId: number,
    newValue: number,
    dryRun: boolean
  ): Promise<RecalculationResponse> {
    return apiClient.post<RecalculationResponse>(
      API_CONFIG.ENDPOINTS.PAYABLE_INCREASE_VALUE(payableId),
      { new_value: newValue, dry_run: dryRun }
    );
  }

  async recalculateInstallments(
    payableId: number,
    mode: 'keep_count' | 'change_count',
    newInstallmentCount: number | undefined,
    dryRun: boolean
  ): Promise<RecalculationResponse> {
    return apiClient.post<RecalculationResponse>(
      API_CONFIG.ENDPOINTS.PAYABLE_RECALCULATE_INSTALLMENTS(payableId),
      {
        mode,
        new_installment_count: newInstallmentCount,
        dry_run: dryRun,
      }
    );
  }

  async redistributeAfterPayment(
    payableId: number,
    data: RedistributeAfterPaymentRequest
  ): Promise<RedistributeAfterPaymentResponse> {
    return apiClient.post<RedistributeAfterPaymentResponse>(
      API_CONFIG.ENDPOINTS.PAYABLE_REDISTRIBUTE_AFTER_PAYMENT(payableId),
      data
    );
  }
}

export const payableInstallmentsService = new PayableInstallmentsService();
