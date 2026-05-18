// Service mocks — hoisted before imports
vi.mock('@/services/library-dashboard-service', () => ({
  libraryDashboardService: {
    getStats: vi.fn(),
  },
}));

vi.mock('@/components/library/ReadingGoalCard', () => ({
  ReadingGoalCard: () => <div data-testid="reading-goal-card" />,
}));

vi.mock('@/components/charts', () => ({
  ChartContainer: () => <div data-testid="chart-container" />,
}));

vi.mock('@/components/charts/EnhancedTooltip', () => ({
  EnhancedTooltip: () => null,
}));

vi.mock('@/lib/chart-colors', () => ({
  useChartColors: () => [
    '#8B5CF6',
    '#22C55E',
    '#EF4444',
    '#F59E0B',
    '#3B82F6',
    '#a855f7',
    '#f97316',
  ],
}));

vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Cell: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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
import LibraryDashboard from '@/pages/LibraryDashboard';
import { libraryDashboardService } from '@/services/library-dashboard-service';

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
  total_books: 42,
  total_authors: 15,
  total_publishers: 8,
  books_reading: 2,
  books_to_read: 10,
  books_read: 30,
  average_rating: 4.2,
  total_pages_read: 12000,
  books_by_genre: [{ genre: 'fiction', genre_display: 'Ficção', count: 20 }],
  recent_readings: [],
  top_rated_books: [],
  total_reading_time_hours: 240,
  average_pages_per_book: 285,
  books_by_language: [],
  books_by_media_type: [],
  most_read_author: null,
  most_read_publisher: null,
  reading_status_distribution: [],
  reading_timeline: [],
  top_authors: [],
  top_publishers: [],
  books_by_literary_type: [],
  top_genres_by_time: [],
  rating_distribution: [],
  reading_goals: [],
};

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LibraryDashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LibraryDashboard', () => {
  beforeEach(() => {
    queryClient.clear();
    mockToast.mockClear();
    vi.mocked(libraryDashboardService.getStats).mockResolvedValue(sampleStats);
  });

  it('renders page heading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('renders total books count', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });

  it('renders total authors count', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
    });
  });

  it('calls getStats on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(libraryDashboardService.getStats).toHaveBeenCalled();
    });
  });

  it('renders books read count', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('30')).toBeInTheDocument();
    });
  });
});
