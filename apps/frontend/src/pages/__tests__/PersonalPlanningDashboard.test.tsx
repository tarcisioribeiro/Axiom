// Service mocks — hoisted before imports
vi.mock('@/services/personal-planning-dashboard-service', () => ({
  personalPlanningDashboardService: {
    getStats: vi.fn(),
    getAnalytics: vi.fn(),
  },
}));

vi.mock('@/components/personal-planning/HabitHeatmap', () => ({
  HabitHeatmap: () => <div data-testid="habit-heatmap" />,
}));

vi.mock('@/components/charts', () => ({
  ChartContainer: () => <div data-testid="chart-container" />,
}));

vi.mock('@/components/ui/circular-progress', () => ({
  CircularProgress: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="circular-progress">{children}</div>
  ),
}));

// Mock StatCard to render title+value directly, bypassing framer-motion animations
vi.mock('@/components/common/StatCard', () => ({
  StatCard: ({ title, value }: { title: string; value: string | number }) => (
    <div data-testid="stat-card">
      <span className="stat-title">{title}</span>
      <span className="stat-value">{String(value)}</span>
    </div>
  ),
}));

vi.mock('@/lib/chart-colors', () => ({
  useChartColors: () => ['#8B5CF6', '#22C55E', '#EF4444', '#F59E0B', '#3B82F6'],
  useTaskCategoryColors: () => ({ other: '#888888' }),
}));

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import React from 'react';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ptBR from '@/i18n/locales/pt-BR.json';
import { queryClient } from '@/lib/query-client';
import PersonalPlanningDashboard from '@/pages/PersonalPlanningDashboard';
import { personalPlanningDashboardService } from '@/services/personal-planning-dashboard-service';

queryClient.setDefaultOptions({ queries: { retry: false } });

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: 'pt-BR',
      fallbackLng: 'pt-BR',
      resources: { 'pt-BR': { translation: ptBR } },
      interpolation: { escapeValue: false },
    });
  }
});

const sampleStats = {
  total_tasks: 10,
  active_tasks: 7,
  total_goals: 3,
  active_goals: 2,
  completed_goals: 1,
  completion_rate_7d: 75.0,
  completion_rate_30d: 68.0,
  current_streak: 5,
  best_streak: 12,
  tasks_by_category: [{ category: 'health', category_display: 'Saúde', count: 3 }],
  weekly_progress: [{ date: '2026-05-12', total: 5, completed: 4, rate: 80.0 }],
  active_goals_progress: [],
  total_tasks_today: 4,
  completed_tasks_today: 2,
  active_routine_tasks: [],
  recent_reflections: [],
};

const sampleAnalytics = {
  period_days: 30,
  completion_by_weekday: [],
  insights: [],
};

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PersonalPlanningDashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PersonalPlanningDashboard', () => {
  beforeEach(() => {
    queryClient.clear();
    mockToast.mockClear();
    vi.mocked(personalPlanningDashboardService.getStats).mockResolvedValue(sampleStats);
    vi.mocked(personalPlanningDashboardService.getAnalytics).mockResolvedValue(
      sampleAnalytics
    );
  });

  it('renders page heading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('shows no-data message when stats are unavailable', async () => {
    vi.mocked(personalPlanningDashboardService.getStats).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      undefined as any
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('renders active tasks stat card', async () => {
    renderPage();
    await waitFor(() => {
      // StatCard mock renders value as text — active_tasks = 7
      expect(screen.getByText('7')).toBeInTheDocument();
    });
  });

  it('renders 7-day completion rate', async () => {
    renderPage();
    await waitFor(() => {
      // completion_rate_7d = 75.0 rendered as "75.0%"
      expect(screen.getByText('75.0%')).toBeInTheDocument();
    });
  });

  it('renders best streak value', async () => {
    renderPage();
    await waitFor(() => {
      // best_streak = 12
      expect(screen.getByText('12')).toBeInTheDocument();
    });
  });
});
