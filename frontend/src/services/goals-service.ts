import { API_CONFIG } from '@/config/constants';
import type { Goal, GoalFormData } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class GoalsService extends BaseService<Goal, GoalFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.GOALS);
  }

  async recalculate(id: number): Promise<Goal> {
    return apiClient.post<Goal>(`${this.endpoint}${id}/recalculate/`);
  }

  async reset(id: number): Promise<Goal> {
    return apiClient.post<Goal>(`${this.endpoint}${id}/reset/`);
  }
}

export const goalsService = new GoalsService();
