/**
 * Dashboard page — accessibility tests (axe).
 *
 * Covers: stat cards and chart containers after data loads.
 */

// ---- Framer-motion mock ----
vi.mock('framer-motion', async (importOriginal) => {
  const React = await import('react');
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) =>
          React.forwardRef(
            ({ children, ...props }: React.ComponentPropsWithRef<'div'>, ref) =>
              React.createElement(tag, { ...props, ref }, children)
          ),
      }
    ),
    useReducedMotion: () => true,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/lib/animations', () => ({
  containerVariants: {},
  itemVariants: {},
  cardVariants: {},
  useCounter: (end: number) => end,
}));

// ---- Service mocks ----
vi.mock('@/services/dashboard-service', () => ({
  dashboardService: {
    getStats: vi.fn().mockResolvedValue({
      total_balance: 10000,
      total_expenses: 2000,
      total_revenues: 5000,
      available_credit_limit: 3000,
      total_credit_limit: 5000,
    }),
    getAccountBalances: vi.fn().mockResolvedValue([]),
    getCreditCardExpensesByCategory: vi.fn().mockResolvedValue([]),
    getBalanceForecast: vi.fn().mockResolvedValue({
      current_total_balance: 8000,
      forecast_balance: 8500,
      pending_expenses: 200,
      pending_revenues: 500,
      pending_card_bills: 0,
      loans_to_receive: 0,
      loans_to_pay: 0,
      pending_payables: 0,
      summary: { total_income: 500, total_outcome: 200, net_change: 300 },
    }),
    getCashFlowForecast: vi.fn().mockResolvedValue({
      period_days: 30,
      start_balance: 10000,
      end_balance: 10300,
      total_revenues: 500,
      total_expenses: 200,
      net_change: 300,
      min_balance: 9800,
      min_balance_date: '2024-01-15',
      daily_breakdown: [],
    }),
    getFinancialAlerts: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/expenses-service', () => ({
  expensesService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/services/revenues-service', () => ({
  revenuesService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/services/credit-cards-service', () => ({
  creditCardsService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/services/credit-card-bills-service', () => ({
  creditCardBillsService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/services/budgets-service', () => ({
  budgetsService: { getStatus: vi.fn().mockResolvedValue([]) },
}));

// ---- Component mocks ----
vi.mock('@/components/charts', () => ({
  ChartContainer: () => <div data-testid="chart-container" />,
}));

vi.mock('@/components/common/AnimatedPage', () => ({
  AnimatedPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/dashboard/AlertsPanel', () => ({
  AlertsPanel: () => <div data-testid="alerts-panel" />,
}));

vi.mock('@/components/dashboard/HealthScore', () => ({
  HealthScore: () => <div data-testid="health-score" />,
}));

vi.mock('@/lib/chart-colors', () => ({
  useChartColors: () => ({
    primary: '#8B5CF6',
    success: '#22C55E',
    danger: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  }),
}));

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

// ---- Imports ----
import { QueryClientProvider } from '@tanstack/react-query';
import { render, act, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { configureAxe, toHaveNoViolations } from 'jest-axe';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ptBR from '@/i18n/locales/pt-BR.json';
import { queryClient } from '@/lib/query-client';
import Dashboard from '@/pages/Dashboard';

queryClient.setDefaultOptions({ queries: { retry: false } });

expect.extend(toHaveNoViolations);
const axe = configureAxe();

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

beforeEach(() => {
  queryClient.clear();
});

function renderDashboard() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Dashboard page accessibility', () => {
  it('stat cards and chart containers — no axe violations', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = renderDashboard());
    });
    // Wait for queries to resolve so we test the loaded state, not the spinner
    await waitFor(() => {
      expect(container.querySelector('[data-testid="chart-container"]')).toBeTruthy();
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
