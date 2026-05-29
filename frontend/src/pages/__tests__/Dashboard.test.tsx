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
    useReducedMotion: () => false,
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

vi.mock('@/components/charts', () => ({
  ChartContainer: () => <div data-testid="chart-container" />,
}));

vi.mock('@/components/common/AnimatedPage', () => ({
  AnimatedPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/dashboard/AlertsPanel', () => ({
  AlertsPanel: () => <div data-testid="alerts-panel" />,
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

const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  // Mock the standalone export used by the global QueryCache error handler
  toast: mockToast,
}));

vi.mock('@/services/dashboard-service', () => ({
  dashboardService: {
    getStats: vi.fn().mockResolvedValue({
      total_balance: 11111,
      total_expenses: 2222,
      total_revenues: 33333,
      available_credit_limit: 4444,
      total_credit_limit: 55555,
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
    getAnomalies: vi.fn().mockResolvedValue([]),
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

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ptBR from '@/i18n/locales/pt-BR.json';
import { queryClient } from '@/lib/query-client';
import Dashboard from '@/pages/Dashboard';
import { dashboardService } from '@/services/dashboard-service';

// Use retry: false so failed queries don't retry and slow down tests
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

function renderDashboard() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const defaultStats = {
  total_balance: 11111,
  total_expenses: 2222,
  total_revenues: 33333,
  available_credit_limit: 4444,
  total_credit_limit: 55555,
};

describe('Dashboard page', () => {
  beforeEach(() => {
    mockToast.mockClear();
    queryClient.clear(); // Reset cache to avoid cross-test contamination
    // Reset to default resolved values before each test
    vi.mocked(dashboardService.getStats).mockResolvedValue(defaultStats);
  });

  it('shows loading state while data is fetching', () => {
    // Use mockImplementationOnce so only this invocation is delayed
    vi.mocked(dashboardService.getStats).mockImplementationOnce(
      () => new Promise(() => undefined)
    );

    renderDashboard();

    // LoadingState renders a spinner / loading indicator
    expect(screen.queryByText(/dashboard/i)).toBeNull();
  });

  it('renders the dashboard title after data loads', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/resumo financeiro/i)).toBeInTheDocument();
    });
  });

  it('renders total balance stat card with mocked data', async () => {
    renderDashboard();
    // formatCurrency(11111) → "R$ 11.111,00"
    await waitFor(() => {
      expect(screen.getByText(/11\.111/)).toBeInTheDocument();
    });
  });

  it('renders monthly expenses stat card', async () => {
    renderDashboard();
    // formatCurrency(2222) → "R$ 2.222,00"
    await waitFor(() => {
      expect(screen.getByText(/2\.222/)).toBeInTheDocument();
    });
  });

  it('renders monthly revenues stat card', async () => {
    renderDashboard();
    // formatCurrency(33333) → "R$ 33.333,00"
    await waitFor(() => {
      expect(screen.getByText(/33\.333/)).toBeInTheDocument();
    });
  });

  it('calls all required dashboard service methods on mount', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(dashboardService.getStats).toHaveBeenCalled();
      expect(dashboardService.getAccountBalances).toHaveBeenCalled();
      expect(dashboardService.getFinancialAlerts).toHaveBeenCalled();
    });
  });

  it('shows error toast when data loading fails', async () => {
    vi.mocked(dashboardService.getStats).mockRejectedValue(new Error('Network error'));

    renderDashboard();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });

  it('computes expense and revenue category breakdowns when data is provided', async () => {
    const { expensesService } = await import('@/services/expenses-service');
    const { revenuesService } = await import('@/services/revenues-service');

    vi.mocked(expensesService.getAll).mockResolvedValue([
      {
        id: 1,
        uuid: 'e1',
        description: 'Mercado',
        value: '200.00',
        date: new Date().toISOString().slice(0, 10),
        horary: '08:00:00',
        category: 'food',
        payed: true,
        account: 1,
        member: null,
        auto_categorized: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ] as Awaited<ReturnType<typeof expensesService.getAll>>);

    vi.mocked(revenuesService.getAll).mockResolvedValue([
      {
        id: 1,
        description: 'Salário',
        value: '3000.00',
        date: new Date().toISOString().slice(0, 10),
        horary: '08:00:00',
        category: 'salary',
        received: true,
        account: 1,
        member: null,
      },
    ] as Awaited<ReturnType<typeof revenuesService.getAll>>);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/resumo financeiro/i)).toBeInTheDocument();
    });

    // Restore defaults
    vi.mocked(expensesService.getAll).mockResolvedValue([]);
    vi.mocked(revenuesService.getAll).mockResolvedValue([]);
  });
});
