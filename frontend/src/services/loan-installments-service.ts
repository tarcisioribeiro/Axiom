import { API_CONFIG } from '@/config/api-config';
import type {
  AmortizationSchedule,
  LoanInstallment,
  LoanPaymentRequest,
  LoanReceiptRequest,
} from '@/types';

import { apiClient } from './api-client';

class LoanInstallmentsService {
  async getByLoan(loanId: number): Promise<LoanInstallment[]> {
    return apiClient.get<LoanInstallment[]>(
      API_CONFIG.ENDPOINTS.LOAN_INSTALLMENTS(loanId)
    );
  }

  async markPaid(
    loanId: number,
    installmentNumber: number,
    paymentExpenseId?: number
  ): Promise<LoanInstallment> {
    return apiClient.patch<LoanInstallment>(
      API_CONFIG.ENDPOINTS.LOAN_INSTALLMENTS(loanId),
      {
        installment_number: installmentNumber,
        payed: true,
        payment_expense: paymentExpenseId ?? null,
      }
    );
  }

  async pay(loanId: number, data: LoanPaymentRequest): Promise<unknown> {
    return apiClient.post(API_CONFIG.ENDPOINTS.LOAN_PAYMENT(loanId), data);
  }

  async receive(loanId: number, data: LoanReceiptRequest): Promise<unknown> {
    return apiClient.post(API_CONFIG.ENDPOINTS.LOAN_RECEIPT(loanId), data);
  }

  async getAmortization(
    loanId: number,
    method: 'price' | 'sac' = 'price'
  ): Promise<AmortizationSchedule> {
    return apiClient.get<AmortizationSchedule>(
      `${API_CONFIG.ENDPOINTS.LOAN_AMORTIZATION(loanId)}?method=${method}`
    );
  }
}

export const loanInstallmentsService = new LoanInstallmentsService();
