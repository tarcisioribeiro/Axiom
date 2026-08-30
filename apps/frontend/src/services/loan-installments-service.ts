import { API_CONFIG } from '@/config/api-config';
import type {
  AmortizationSchedule,
  Loan,
  LoanInstallment,
  LoanPaymentRequest,
  LoanReceiptRequest,
  LoanRecalculationResponse,
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

  async createPaymentPlan(
    loanId: number,
    installments: number,
    firstDueDate?: string
  ): Promise<{ loan: Loan; fixed_expense: unknown }> {
    return apiClient.post(API_CONFIG.ENDPOINTS.LOAN_PAYMENT_PLAN(loanId), {
      installments,
      first_due_date: firstDueDate,
    });
  }

  async updateInstallment(
    loanId: number,
    installmentNumber: number,
    data: { value?: number; due_date?: string }
  ): Promise<LoanInstallment> {
    return apiClient.patch<LoanInstallment>(
      API_CONFIG.ENDPOINTS.LOAN_INSTALLMENTS(loanId),
      { installment_number: installmentNumber, ...data }
    );
  }

  async recalculateInstallments(
    loanId: number,
    mode: 'keep_count' | 'change_count',
    newInstallmentCount: number | undefined,
    dryRun: boolean
  ): Promise<LoanRecalculationResponse> {
    return apiClient.post<LoanRecalculationResponse>(
      API_CONFIG.ENDPOINTS.LOAN_RECALCULATE_INSTALLMENTS(loanId),
      {
        mode,
        new_installment_count: newInstallmentCount,
        dry_run: dryRun,
      }
    );
  }
}

export const loanInstallmentsService = new LoanInstallmentsService();
