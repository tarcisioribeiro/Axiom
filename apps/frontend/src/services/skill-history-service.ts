import { API_CONFIG } from '@/config/constants';

import { apiClient } from './api-client';

export interface SkillHistoryEntry {
  id: number;
  uuid: string;
  skill: number;
  proficiency: string;
  proficiency_display: string;
  proficiency_order: number;
  status: string;
  status_display: string;
  notes: string | null;
  created_at: string;
}

class SkillHistoryService {
  getHistory(
    skillId: number
  ): Promise<{ results: SkillHistoryEntry[]; count: number }> {
    return apiClient.get(`${API_CONFIG.ENDPOINTS.SKILL_HISTORY}${skillId}/history/`);
  }
}

export const skillHistoryService = new SkillHistoryService();
