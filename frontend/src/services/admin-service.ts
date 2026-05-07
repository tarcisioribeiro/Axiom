import { API_CONFIG } from '@/config/constants';
import type {
  AdminLogsResponse,
  HealthResponse,
  IntegrationsResponse,
  SystemConfig,
} from '@/types';

import { apiClient } from './api-client';

class AdminService {
  async getConfigs(): Promise<SystemConfig[]> {
    return apiClient.get<SystemConfig[]>(API_CONFIG.ENDPOINTS.ADMIN_CONFIG);
  }

  async updateConfig(key: string, value: string): Promise<SystemConfig> {
    return apiClient.patch<SystemConfig>(
      API_CONFIG.ENDPOINTS.ADMIN_CONFIG_DETAIL(key),
      {
        value,
      }
    );
  }

  async getHealth(): Promise<HealthResponse> {
    return apiClient.get<HealthResponse>(API_CONFIG.ENDPOINTS.ADMIN_HEALTH);
  }

  async getIntegrations(): Promise<IntegrationsResponse> {
    return apiClient.get<IntegrationsResponse>(API_CONFIG.ENDPOINTS.ADMIN_INTEGRATIONS);
  }

  async getLogs(params?: {
    page?: number;
    page_size?: number;
    username?: string;
    action?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<AdminLogsResponse> {
    return apiClient.get<AdminLogsResponse>(API_CONFIG.ENDPOINTS.ADMIN_LOGS, params);
  }

  async sendTestEmail(toEmail: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(API_CONFIG.ENDPOINTS.ADMIN_EMAIL_TEST, {
      to_email: toEmail,
    });
  }

  async getAgentsStatus(): Promise<Record<string, unknown>> {
    return apiClient.get<Record<string, unknown>>(
      API_CONFIG.ENDPOINTS.ADMIN_AGENTS_STATUS
    );
  }

  async restartAll(
    mode?: 'docker' | 'kubernetes'
  ): Promise<{ success: boolean; message: string; results: Record<string, string> }> {
    return apiClient.post<{
      success: boolean;
      message: string;
      results: Record<string, string>;
    }>(API_CONFIG.ENDPOINTS.ADMIN_RESTART_ALL, mode ? { mode } : {});
  }
}

export const adminService = new AdminService();
