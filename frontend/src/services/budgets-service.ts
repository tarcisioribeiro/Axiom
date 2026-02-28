import { API_CONFIG } from '@/config/constants';
import type { Budget, BudgetFormData, BudgetStatus } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class BudgetsService extends BaseService<Budget, BudgetFormData, BudgetFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.BUDGETS);
  }

  async getStatus(params?: { month?: number; year?: number }): Promise<BudgetStatus[]> {
    return apiClient.get<BudgetStatus[]>(API_CONFIG.ENDPOINTS.BUDGETS_STATUS, params);
  }
}

export const budgetsService = new BudgetsService();
