import { API_CONFIG } from '@/config/constants';
import type { Budget, BudgetFormData, BudgetHistory, BudgetStatus } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class BudgetsService extends BaseService<Budget, BudgetFormData, BudgetFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.BUDGETS);
  }

  async getStatus(params?: { month?: number; year?: number }): Promise<BudgetStatus[]> {
    return apiClient.get<BudgetStatus[]>(API_CONFIG.ENDPOINTS.BUDGETS_STATUS, params);
  }

  async getHistory(params: {
    category: string;
    months?: number;
  }): Promise<BudgetHistory[]> {
    return apiClient.get<BudgetHistory[]>(API_CONFIG.ENDPOINTS.BUDGET_HISTORY, params);
  }
}

export const budgetsService = new BudgetsService();
