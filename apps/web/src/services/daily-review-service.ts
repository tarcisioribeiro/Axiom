import { API_CONFIG } from '@/config/api-config';
import type {
  DailyReviewState,
  ReviewStepKey,
  UserPreferences,
} from '@/types/daily-review';

import { apiClient } from './api-client';

const BASE = API_CONFIG.ENDPOINTS.DAILY_REVIEW;

class DailyReviewService {
  get(): Promise<DailyReviewState> {
    return apiClient.get<DailyReviewState>(BASE);
  }

  resolveBacklog(
    justifications: Partial<Record<ReviewStepKey, string>>
  ): Promise<void> {
    return apiClient.post(`${BASE}backlog/`, { justifications });
  }

  /** Justifica os itens do dia e conclui, numa só requisição (tudo ou nada). */
  complete(
    date: string,
    resolutions: { step: ReviewStepKey; item_key: string; justification: string }[] = []
  ): Promise<void> {
    return apiClient.post(`${BASE}complete/`, { date, resolutions });
  }

  getPreferences(): Promise<UserPreferences> {
    return apiClient.get<UserPreferences>(API_CONFIG.ENDPOINTS.MY_PREFERENCES);
  }

  updatePreferences(data: Partial<UserPreferences>): Promise<UserPreferences> {
    return apiClient.patch<UserPreferences>(API_CONFIG.ENDPOINTS.MY_PREFERENCES, data);
  }
}

export const dailyReviewService = new DailyReviewService();
