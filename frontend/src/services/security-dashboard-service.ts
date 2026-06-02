import { API_CONFIG } from '@/config/api-config';

import { apiClient } from './api-client';

export interface VaultHealthIssuesSummary {
  weak: number;
  medium: number;
  duplicate: number;
  outdated: number;
}

export interface VaultHealthPassword {
  id: number;
  title: string;
  username: string;
  category: string;
  category_display: string;
  last_password_change: string;
  issues: Array<'weak' | 'medium' | 'duplicate' | 'outdated'>;
  duplicate_group: number | null;
}

export interface VaultHealthReport {
  score: number;
  total_passwords: number;
  issues_summary: VaultHealthIssuesSummary;
  problematic_passwords: VaultHealthPassword[];
}

export interface SecurityDashboardStats {
  total_passwords: number;
  total_stored_cards: number;
  total_stored_accounts: number;
  total_archives: number;
  passwords_by_category: Array<{
    category: string;
    category_display: string;
    count: number;
  }>;
  recent_activity: Array<{
    action: string;
    action_display: string;
    model_name: string;
    description: string;
    created_at: string;
  }>;
  items_distribution: Array<{
    type: string;
    type_display: string;
    count: number;
  }>;
  password_strength_distribution: Array<{
    strength: string;
    strength_display: string;
    count: number;
  }>;
  activities_by_action: Array<{
    action: string;
    action_display: string;
    count: number;
  }>;
  activities_timeline: Array<{
    month: string;
    count: number;
  }>;
}

export interface VaultHealthSnapshot {
  id: number;
  score: number;
  weak_passwords: number;
  medium_passwords: number;
  duplicate_passwords: number;
  outdated_passwords: number;
  total_passwords: number;
  snapshot_date: string;
}

export interface VaultAlertConfig {
  id?: number;
  alert_on_new_ip: boolean;
  alert_on_failed_unlock: boolean;
  alert_on_reveal: boolean;
  failed_unlock_threshold: number;
}

export interface PasswordHistoryEntry {
  id: number;
  changed_at: string;
  changed_by_username: string | null;
  created_at: string;
}

class SecurityDashboardService {
  async getStats(): Promise<SecurityDashboardStats> {
    return await apiClient.get<SecurityDashboardStats>(
      '/api/v1/security/dashboard/stats/'
    );
  }

  async getHealthReport(): Promise<VaultHealthReport> {
    return await apiClient.get<VaultHealthReport>(
      API_CONFIG.ENDPOINTS.SECURITY_VAULT_HEALTH
    );
  }

  async getVaultHealthHistory(): Promise<VaultHealthSnapshot[]> {
    const res = await apiClient.get<{ results: VaultHealthSnapshot[] }>(
      '/api/v1/security/vault-health-history/'
    );
    return res.results ?? (res as unknown as VaultHealthSnapshot[]);
  }

  async getPasswordHistory(passwordId: number): Promise<PasswordHistoryEntry[]> {
    const res = await apiClient.get<{ results: PasswordHistoryEntry[] }>(
      `/api/v1/security/passwords/${passwordId}/history/`
    );
    return res.results ?? (res as unknown as PasswordHistoryEntry[]);
  }

  async verifyTOTP(passwordId: number, code: string): Promise<{ valid: boolean }> {
    return await apiClient.post<{ valid: boolean }>(
      `/api/v1/security/passwords/${passwordId}/totp/verify/`,
      { code }
    );
  }

  async getAlertConfig(): Promise<VaultAlertConfig> {
    return await apiClient.get<VaultAlertConfig>('/api/v1/security/alert-config/');
  }

  async updateAlertConfig(data: Partial<VaultAlertConfig>): Promise<VaultAlertConfig> {
    return await apiClient.put<VaultAlertConfig>(
      '/api/v1/security/alert-config/',
      data
    );
  }
}

export const securityDashboardService = new SecurityDashboardService();
