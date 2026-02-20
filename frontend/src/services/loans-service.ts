import { apiClient } from './api-client';
import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type { Loan, LoanFormData } from '@/types';

class LoansService extends BaseService<Loan, LoanFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.LOANS);
  }

  async create(data: LoanFormData): Promise<Loan> {
    const formData = new FormData();

    formData.append('description', data.description);
    formData.append('value', data.value.toString());
    formData.append('payed_value', data.payed_value.toString());
    formData.append('date', data.date);
    formData.append('horary', data.horary);
    formData.append('category', data.category);
    formData.append('account', data.account.toString());
    formData.append('benefited', data.benefited.toString());
    formData.append('creditor', data.creditor.toString());
    formData.append('payed', data.payed.toString());

    if (data.interest_rate !== undefined) {
      formData.append('interest_rate', data.interest_rate.toString());
    }
    if (data.installments !== undefined) {
      formData.append('installments', data.installments.toString());
    }
    if (data.due_date) {
      formData.append('due_date', data.due_date);
    }
    if (data.contract_document) {
      formData.append('contract_document', data.contract_document);
    }
    if (data.payment_frequency) {
      formData.append('payment_frequency', data.payment_frequency);
    }
    if (data.late_fee !== undefined) {
      formData.append('late_fee', data.late_fee.toString());
    }
    if (data.guarantor) {
      formData.append('guarantor', data.guarantor.toString());
    }
    if (data.notes) {
      formData.append('notes', data.notes);
    }
    if (data.status) {
      formData.append('status', data.status);
    }

    return apiClient.post<Loan>(this.endpoint, formData);
  }

  async update(id: number, data: Partial<LoanFormData>): Promise<Loan> {
    const formData = new FormData();

    if (data.description) formData.append('description', data.description);
    if (data.value !== undefined) formData.append('value', data.value.toString());
    if (data.payed_value !== undefined)
      formData.append('payed_value', data.payed_value.toString());
    if (data.date) formData.append('date', data.date);
    if (data.horary) formData.append('horary', data.horary);
    if (data.category) formData.append('category', data.category);
    if (data.account) formData.append('account', data.account.toString());
    if (data.benefited) formData.append('benefited', data.benefited.toString());
    if (data.creditor) formData.append('creditor', data.creditor.toString());
    if (data.payed !== undefined) formData.append('payed', data.payed.toString());
    if (data.interest_rate !== undefined)
      formData.append('interest_rate', data.interest_rate.toString());
    if (data.installments !== undefined)
      formData.append('installments', data.installments.toString());
    if (data.due_date) formData.append('due_date', data.due_date);
    if (data.contract_document)
      formData.append('contract_document', data.contract_document);
    if (data.payment_frequency)
      formData.append('payment_frequency', data.payment_frequency);
    if (data.late_fee !== undefined)
      formData.append('late_fee', data.late_fee.toString());
    if (data.guarantor) formData.append('guarantor', data.guarantor.toString());
    if (data.notes) formData.append('notes', data.notes);
    if (data.status) formData.append('status', data.status);

    return apiClient.patch<Loan>(`${this.endpoint}${id}/`, formData);
  }
}

export const loansService = new LoansService();
