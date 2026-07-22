import { API_CONFIG } from '@/config/constants';
import type { Notification, NotificationSummary } from '@/types';

import { apiClient } from './api-client';

class NotificationsService {
  async getAll(): Promise<Notification[]> {
    const response = await apiClient.get<{ results: Notification[] } | Notification[]>(
      API_CONFIG.ENDPOINTS.NOTIFICATIONS
    );
    return Array.isArray(response) ? response : response.results;
  }

  async getSummary(): Promise<NotificationSummary> {
    return apiClient.get<NotificationSummary>(
      API_CONFIG.ENDPOINTS.NOTIFICATIONS_SUMMARY
    );
  }

  async markAsRead(id: number): Promise<Notification> {
    return apiClient.patch<Notification>(
      `${API_CONFIG.ENDPOINTS.NOTIFICATIONS}${id}/`,
      { is_read: true }
    );
  }

  async markAllAsRead(): Promise<{ marked_read: number }> {
    return apiClient.post<{ marked_read: number }>(
      API_CONFIG.ENDPOINTS.NOTIFICATIONS_MARK_ALL_READ,
      {}
    );
  }
}

export const notificationsService = new NotificationsService();
