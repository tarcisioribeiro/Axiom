import { API_CONFIG } from '@/config/constants';
import type {
  FixedExpense,
  FixedExpenseFormData,
  BulkGenerateRequest,
  BulkGenerateResponse,
  FixedExpenseStats,
  FixedExpenseGenerationLog,
} from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

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

  async getGenerationLog(): Promise<FixedExpenseGenerationLog[]> {
    return apiClient.get<FixedExpenseGenerationLog[]>(
      `${this.endpoint}generation-log/`
    );
  }
}

export const fixedExpensesService = new FixedExpensesService();
