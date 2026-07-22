import type {
  PersonalPlanningAnalytics,
  PersonalPlanningDashboardStats,
} from '@/types';

import { apiClient } from './api-client';

class PersonalPlanningDashboardService {
  async getStats(): Promise<PersonalPlanningDashboardStats> {
    return await apiClient.get<PersonalPlanningDashboardStats>(
      '/api/v1/personal-planning/dashboard/stats/'
    );
  }

  async getAnalytics(): Promise<PersonalPlanningAnalytics> {
    return await apiClient.get<PersonalPlanningAnalytics>(
      '/api/v1/personal-planning/analytics/'
    );
  }
}

export const personalPlanningDashboardService = new PersonalPlanningDashboardService();
