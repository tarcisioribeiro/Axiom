import { API_CONFIG } from '@/config/api-config';

import { apiClient } from './api-client';

export interface SelfEsteemAssessment {
  id: number;
  assessed_at: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  q5: number;
  q6: number;
  q7: number;
  q8: number;
  q9: number;
  q10: number;
  score: number;
  ai_analysis: string;
  created_at: string;
}

export interface SelfEsteemAssessmentCreate {
  assessed_at: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  q5: number;
  q6: number;
  q7: number;
  q8: number;
  q9: number;
  q10: number;
}

export interface EmotionalCheckin {
  id: number;
  checked_at: string;
  loneliness: number;
  neediness: number;
  anxiety: number;
  sadness: number;
  motivation: number;
  energy: number;
  what_happened: string;
  occupying_thoughts: string;
  created_at: string;
}

export interface EmotionalCheckinCreate {
  checked_at: string;
  loneliness: number;
  neediness: number;
  anxiety: number;
  sadness: number;
  motivation: number;
  energy: number;
  what_happened?: string;
  occupying_thoughts?: string;
}

export type EmotionalState =
  | 'loneliness'
  | 'neediness'
  | 'anxiety'
  | 'boredom'
  | 'frustration'
  | 'anger'
  | 'other';

export type ImpulseType =
  'pornography' | 'alcohol' | 'social_media' | 'shopping' | 'procrastination' | 'other';

export interface CrisisActionPlan {
  '5min': string[];
  '10min': string[];
  '20min': string[];
}

export interface CrisisAIResponse {
  validation: string;
  explanation: string;
  action_plan: CrisisActionPlan;
  affirmation: string;
}

export interface CrisisImpulseLog {
  id: number;
  logged_at: string;
  emotional_state: EmotionalState;
  emotional_state_display: string;
  emotional_state_other: string;
  impulse_type: ImpulseType;
  impulse_type_display: string;
  impulse_type_other: string;
  ai_response: string;
  resolved: boolean;
  created_at: string;
}

export interface CrisisImpulseLogCreate {
  logged_at?: string;
  emotional_state: EmotionalState;
  emotional_state_other?: string;
  impulse_type: ImpulseType;
  impulse_type_other?: string;
}

export type InterventionCategory =
  'self_esteem' | 'loneliness' | 'neediness' | 'anxiety' | 'emotional_dependency';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface WellnessIntervention {
  id: number;
  title: string;
  description: string;
  category: InterventionCategory;
  category_display: string;
  duration_minutes: number;
  difficulty: DifficultyLevel;
  difficulty_display: string;
  expected_benefit: string;
  is_global: boolean;
}

export interface WellnessInterventionCompletion {
  id: number;
  intervention: number;
  intervention_title: string;
  intervention_category: InterventionCategory;
  completed_at: string;
  rating: number | null;
  notes: string;
  created_at: string;
}

export interface WellnessWeeklyReport {
  id: number;
  week_start: string;
  week_end: string;
  ai_summary: string;
  attention_points: string[];
  suggestions: string[];
  avg_loneliness: string | null;
  avg_anxiety: string | null;
  avg_motivation: string | null;
  latest_self_esteem_score: number | null;
  created_at: string;
}

export interface WellnessDashboard {
  self_esteem: {
    current_score: number | null;
    assessed_at: string | null;
    week_avg: number | null;
  };
  emotional: {
    avg_loneliness: number | null;
    avg_anxiety: number | null;
    avg_motivation: number | null;
    avg_energy: number | null;
    checkins_this_week: number;
  };
  impulses: {
    count_this_week: number;
    resolved_this_week: number;
  };
  interventions: {
    completed_this_week: number;
  };
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

class WellnessService {
  getDashboard(): Promise<WellnessDashboard> {
    return apiClient.get<WellnessDashboard>(API_CONFIG.ENDPOINTS.WELLNESS_DASHBOARD);
  }

  getSelfEsteemHistory(): Promise<PaginatedResponse<SelfEsteemAssessment>> {
    return apiClient.get<PaginatedResponse<SelfEsteemAssessment>>(
      API_CONFIG.ENDPOINTS.WELLNESS_SELF_ESTEEM
    );
  }

  createSelfEsteemAssessment(
    data: SelfEsteemAssessmentCreate
  ): Promise<SelfEsteemAssessment> {
    return apiClient.post<SelfEsteemAssessment>(
      API_CONFIG.ENDPOINTS.WELLNESS_SELF_ESTEEM,
      data
    );
  }

  getCheckins(days?: number): Promise<PaginatedResponse<EmotionalCheckin>> {
    return apiClient.get<PaginatedResponse<EmotionalCheckin>>(
      API_CONFIG.ENDPOINTS.WELLNESS_CHECKINS,
      days ? { days } : undefined
    );
  }

  createCheckin(data: EmotionalCheckinCreate): Promise<EmotionalCheckin> {
    return apiClient.post<EmotionalCheckin>(
      API_CONFIG.ENDPOINTS.WELLNESS_CHECKINS,
      data
    );
  }

  getCrisisLogs(): Promise<PaginatedResponse<CrisisImpulseLog>> {
    return apiClient.get<PaginatedResponse<CrisisImpulseLog>>(
      API_CONFIG.ENDPOINTS.WELLNESS_CRISIS
    );
  }

  createCrisisLog(data: CrisisImpulseLogCreate): Promise<CrisisImpulseLog> {
    return apiClient.post<CrisisImpulseLog>(API_CONFIG.ENDPOINTS.WELLNESS_CRISIS, data);
  }

  resolveCrisisLog(id: number): Promise<CrisisImpulseLog> {
    return apiClient.patch<CrisisImpulseLog>(
      `${API_CONFIG.ENDPOINTS.WELLNESS_CRISIS}${id}/resolve/`
    );
  }

  getInterventions(params?: {
    category?: InterventionCategory;
    max_duration?: number;
  }): Promise<PaginatedResponse<WellnessIntervention>> {
    return apiClient.get<PaginatedResponse<WellnessIntervention>>(
      API_CONFIG.ENDPOINTS.WELLNESS_INTERVENTIONS,
      params
    );
  }

  completeIntervention(data: {
    intervention: number;
    completed_at?: string;
    rating?: number;
    notes?: string;
  }): Promise<WellnessInterventionCompletion> {
    return apiClient.post<WellnessInterventionCompletion>(
      API_CONFIG.ENDPOINTS.WELLNESS_INTERVENTION_COMPLETIONS,
      data
    );
  }

  getCompletions(): Promise<PaginatedResponse<WellnessInterventionCompletion>> {
    return apiClient.get<PaginatedResponse<WellnessInterventionCompletion>>(
      API_CONFIG.ENDPOINTS.WELLNESS_INTERVENTION_COMPLETIONS
    );
  }

  getWeeklyReports(): Promise<PaginatedResponse<WellnessWeeklyReport>> {
    return apiClient.get<PaginatedResponse<WellnessWeeklyReport>>(
      API_CONFIG.ENDPOINTS.WELLNESS_WEEKLY_REPORTS
    );
  }

  generateWeeklyReport(): Promise<WellnessWeeklyReport> {
    return apiClient.post<WellnessWeeklyReport>(
      API_CONFIG.ENDPOINTS.WELLNESS_WEEKLY_REPORTS_GENERATE
    );
  }
}

export const wellnessService = new WellnessService();
