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
}

export const securityDashboardService = new SecurityDashboardService();
