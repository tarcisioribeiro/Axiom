import { API_CONFIG } from '@/config/constants';
import type {
  FixedExpense,
  FixedExpenseFormData,
  BulkGenerateRequest,
  BulkGenerateResponse,
  FixedExpenseStats,
  FixedExpenseGenerationLog,
  FullyGeneratedMonthsResponse,
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

  async getFullyGeneratedMonths(): Promise<string[]> {
    const data = await apiClient.get<FullyGeneratedMonthsResponse>(
      `${this.endpoint}generated-months/`
    );
    return data.fully_generated_months ?? [];
  }
}

export const fixedExpensesService = new FixedExpensesService();
