import { apiClient } from './api-client';

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
}

export const securityDashboardService = new SecurityDashboardService();
