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

  async restart(id: number): Promise<Goal> {
    return apiClient.post<Goal>(`${this.endpoint}${id}/restart/`);
  }

  async registerFailure(id: number, failureDate: string): Promise<Goal> {
    return apiClient.post<Goal>(`${this.endpoint}${id}/register-failure/`, {
      failure_date: failureDate,
    });
  }
}

export const goalsService = new GoalsService();
