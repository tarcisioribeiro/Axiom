import { API_CONFIG } from '@/config/constants';

import { apiClient } from './api-client';

export interface IntellectBadge {
  id: number;
  code: string;
  code_display: string;
  level: 'bronze' | 'silver' | 'gold';
  level_display: string;
  awarded_at: string;
  created_at: string;
}

class IntellectBadgesService {
  async getAll(): Promise<IntellectBadge[]> {
    const response = await apiClient.get<{ results: IntellectBadge[]; count: number }>(
      API_CONFIG.ENDPOINTS.INTELLECT_BADGES
    );
    return response.data.results ?? [];
  }
}

export const intellectBadgesService = new IntellectBadgesService();
