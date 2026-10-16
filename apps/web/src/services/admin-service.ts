import { API_CONFIG } from '@/config/constants';
import type {
  AdminLogsResponse,
  HealthResponse,
  IntegrationsResponse,
  PermissionUser,
  ScreenCatalogModule,
  ScreenGrants,
  StaffUser,
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

  async revealConfig(key: string): Promise<{ value: string | null }> {
    return apiClient.get<{ value: string | null }>(
      API_CONFIG.ENDPOINTS.ADMIN_CONFIG_REVEAL(key)
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

  async getStaff(): Promise<StaffUser[]> {
    return apiClient.get<StaffUser[]>(API_CONFIG.ENDPOINTS.ADMIN_STAFF);
  }

  async createStaff(data: {
    username: string;
    password: string;
    name: string;
    document: string;
    phone: string;
    email: string;
  }): Promise<unknown> {
    return apiClient.post(API_CONFIG.ENDPOINTS.ADMIN_STAFF, data);
  }

  async setStaffActive(id: number, isActive: boolean): Promise<StaffUser> {
    return apiClient.patch<StaffUser>(API_CONFIG.ENDPOINTS.ADMIN_STAFF_DETAIL(id), {
      is_active: isActive,
    });
  }

  async getScreenCatalog(): Promise<ScreenCatalogModule[]> {
    return apiClient.get<ScreenCatalogModule[]>(
      API_CONFIG.ENDPOINTS.ADMIN_PERMISSIONS_SCREENS
    );
  }

  async getPermissionUsers(q?: string): Promise<PermissionUser[]> {
    return apiClient.get<PermissionUser[]>(
      API_CONFIG.ENDPOINTS.ADMIN_PERMISSIONS_USERS,
      {
        q: q || undefined,
      }
    );
  }

  async getUserScreens(
    id: number
  ): Promise<PermissionUser & { screens: ScreenGrants }> {
    return apiClient.get(API_CONFIG.ENDPOINTS.ADMIN_PERMISSIONS_USER(id));
  }

  async saveUserScreens(id: number, screens: ScreenGrants): Promise<unknown> {
    return apiClient.put(API_CONFIG.ENDPOINTS.ADMIN_PERMISSIONS_USER(id), { screens });
  }

  async setUserActive(id: number, isActive: boolean): Promise<PermissionUser> {
    return apiClient.patch<PermissionUser>(
      API_CONFIG.ENDPOINTS.ADMIN_PERMISSIONS_USER(id),
      { is_active: isActive }
    );
  }

  async getScreenDefaults(): Promise<{ screens: ScreenGrants }> {
    return apiClient.get<{ screens: ScreenGrants }>(
      API_CONFIG.ENDPOINTS.ADMIN_PERMISSIONS_DEFAULTS
    );
  }

  async saveScreenDefaults(screens: ScreenGrants): Promise<unknown> {
    return apiClient.put(API_CONFIG.ENDPOINTS.ADMIN_PERMISSIONS_DEFAULTS, { screens });
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
