import { API_CONFIG } from '@/config/constants';
import type { HeatmapData } from '@/types';

import { apiClient } from './api-client';

interface HeatmapParams {
  task_id?: string | number;
  year?: number;
}

class HabitHeatmapService {
  async getHeatmap(params: HeatmapParams = {}): Promise<HeatmapData> {
    const searchParams = new URLSearchParams();
    if (params.task_id !== undefined) {
      searchParams.set('task_id', String(params.task_id));
    }
    if (params.year !== undefined) {
      searchParams.set('year', String(params.year));
    }
    const query = searchParams.toString();
    const url = `${API_CONFIG.ENDPOINTS.ROUTINE_TASK_HEATMAP}${query ? `?${query}` : ''}`;
    return apiClient.get<HeatmapData>(url);
  }
}

export const habitHeatmapService = new HabitHeatmapService();
