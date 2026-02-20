import { apiClient } from './api-client';
import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type {
  FixedExpense,
  FixedExpenseFormData,
  BulkGenerateRequest,
  BulkGenerateResponse,
  FixedExpenseStats,
} from '@/types';

class FixedExpensesService extends BaseService<FixedExpense, FixedExpenseFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.FIXED_EXPENSES);
  }

  async bulkGenerate(request: BulkGenerateRequest): Promise<BulkGenerateResponse> {
    return apiClient.post<BulkGenerateResponse>(`${this.endpoint}generate/`, request);
  }

  async getStats(): Promise<FixedExpenseStats> {
    return apiClient.get<FixedExpenseStats>(`${this.endpoint}stats/`);
  }
}

export const fixedExpensesService = new FixedExpensesService();
