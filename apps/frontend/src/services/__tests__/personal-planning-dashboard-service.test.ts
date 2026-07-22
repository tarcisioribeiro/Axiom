import { describe, it, expect, vi, beforeEach } from 'vitest';

import { apiClient } from '@/services/api-client';
import { personalPlanningDashboardService } from '@/services/personal-planning-dashboard-service';
import type {
  HabitInsight,
  PersonalPlanningAnalytics,
  PersonalPlanningDashboardStats,
} from '@/types';

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockStats: PersonalPlanningDashboardStats = {
  total_tasks: 10,
  active_tasks: 8,
  total_goals: 5,
  active_goals: 3,
  completed_goals: 2,
  completion_rate_7d: 75.0,
  completion_rate_30d: 68.5,
  current_streak: 5,
  best_streak: 14,
  tasks_by_category: [{ category: 'health', category_display: 'Saúde', count: 3 }],
  weekly_progress: [],
  active_goals_progress: [],
  total_tasks_today: 5,
  completed_tasks_today: 3,
  active_routine_tasks: [],
  recent_reflections: [],
};

const mockAnalytics: PersonalPlanningAnalytics = {
  period_days: 90,
  completion_by_weekday: [
    { weekday: 0, weekday_display: 'Segunda-feira', total: 10, completed: 8, rate: 80 },
    { weekday: 1, weekday_display: 'Terça-feira', total: 10, completed: 5, rate: 50 },
    { weekday: 5, weekday_display: 'Sábado', total: 4, completed: 1, rate: 25 },
    { weekday: 6, weekday_display: 'Domingo', total: 4, completed: 1, rate: 25 },
  ],
  insights: [{ type: 'best_day' as HabitInsight['type'], weekday: 0, rate: 80 }],
};

describe('PersonalPlanningDashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStats()', () => {
    it('calls the correct endpoint and returns stats', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockStats);
      const result = await personalPlanningDashboardService.getStats();
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/personal-planning/dashboard/stats/'
      );
      expect(result.active_tasks).toBe(8);
      expect(result.current_streak).toBe(5);
    });
  });

  describe('getAnalytics()', () => {
    it('calls the analytics endpoint and returns analytics data', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockAnalytics);
      const result = await personalPlanningDashboardService.getAnalytics();
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/personal-planning/analytics/'
      );
      expect(result.period_days).toBe(90);
      expect(result.completion_by_weekday).toHaveLength(4);
      expect(result.insights).toHaveLength(1);
    });

    it('returns weekday analytics with correct shape', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockAnalytics);
      const result = await personalPlanningDashboardService.getAnalytics();
      const monday = result.completion_by_weekday[0];
      expect(monday.weekday).toBe(0);
      expect(monday.rate).toBe(80);
      expect(monday.weekday_display).toBe('Segunda-feira');
    });

    it('handles weekdays with null rate (no data)', async () => {
      const analyticsWithNull: PersonalPlanningAnalytics = {
        ...mockAnalytics,
        completion_by_weekday: [
          {
            weekday: 2,
            weekday_display: 'Quarta-feira',
            total: 0,
            completed: 0,
            rate: null,
          },
        ],
      };
      vi.mocked(apiClient.get).mockResolvedValueOnce(analyticsWithNull);
      const result = await personalPlanningDashboardService.getAnalytics();
      expect(result.completion_by_weekday[0].rate).toBeNull();
    });
  });
});
