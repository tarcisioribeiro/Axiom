import { API_CONFIG } from '@/config/constants';
import type {
  CreateNotificationPreference,
  NotificationPreference,
  UpdateNotificationPreference,
} from '@/types';

import { apiClient } from './api-client';

class NotificationPreferencesService {
  async getAll(): Promise<NotificationPreference[]> {
    const response = await apiClient.get<
      { results: NotificationPreference[] } | NotificationPreference[]
    >(API_CONFIG.ENDPOINTS.NOTIFICATION_PREFERENCES);
    return Array.isArray(response) ? response : response.results;
  }

  async create(data: CreateNotificationPreference): Promise<NotificationPreference> {
    return apiClient.post<NotificationPreference>(
      API_CONFIG.ENDPOINTS.NOTIFICATION_PREFERENCES,
      data
    );
  }

  async update(
    id: number,
    data: UpdateNotificationPreference
  ): Promise<NotificationPreference> {
    return apiClient.patch<NotificationPreference>(
      `${API_CONFIG.ENDPOINTS.NOTIFICATION_PREFERENCES}${id}/`,
      data
    );
  }

  async delete(id: number): Promise<void> {
    return apiClient.delete(`${API_CONFIG.ENDPOINTS.NOTIFICATION_PREFERENCES}${id}/`);
  }
}

export const notificationPreferencesService = new NotificationPreferencesService();
