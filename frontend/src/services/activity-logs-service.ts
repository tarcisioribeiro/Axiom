import { apiClient } from './api-client';
import { API_CONFIG } from '@/config/constants';
import type { ActivityLog, PaginatedResponse } from '@/types';

class ActivityLogsService {
  async getAll(): Promise<ActivityLog[]> {
    const response = await apiClient.get<PaginatedResponse<ActivityLog>>(
      API_CONFIG.ENDPOINTS.ACTIVITY_LOGS
    );
    return response.results;
  }
}

export const activityLogsService = new ActivityLogsService();
