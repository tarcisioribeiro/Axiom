import { API_CONFIG } from '@/config/constants';
import type { ActivityLog, PaginatedResponse } from '@/types';

import { apiClient } from './api-client';

class ActivityLogsService {
  async getAll(): Promise<ActivityLog[]> {
    const response = await apiClient.get<PaginatedResponse<ActivityLog>>(
      API_CONFIG.ENDPOINTS.ACTIVITY_LOGS
    );
    return response.results;
  }

  async exportCSV(): Promise<void> {
    const response = await apiClient.getBlob(API_CONFIG.ENDPOINTS.ACTIVITY_LOGS_EXPORT);
    const url = URL.createObjectURL(response);
    const a = document.createElement('a');
    a.href = url;
    a.download = `axiom_activity_log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const activityLogsService = new ActivityLogsService();
