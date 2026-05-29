// Service mocks — hoisted before imports
vi.mock('@/services/budgets-service', () => ({
  budgetsService: {
    getAll: vi.fn().mockResolvedValue([]),
    getStatus: vi.fn().mockResolvedValue([]),
    create: vi
      .fn()
      .mockResolvedValue({ id: 1, category: 'food and drink', limit_amount: 500 }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({ suggestions: [] }),
  },
}));

vi.mock('@/services/members-service', () => ({
  membersService: { getAll: vi.fn().mockResolvedValue([]) },
}));

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

const { mockShowConfirm } = vi.hoisted(() => ({
  mockShowConfirm: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/hooks/use-alert-dialog', () => ({
  useAlertDialog: () => ({ showConfirm: mockShowConfirm }),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ user: { id: 1, username: 'test' } }),
}));

vi.mock('@/components/common/FilterBar', () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}));

vi.mock('@/components/common/AnimatedPage', () => ({
  AnimatedPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ptBR from '@/i18n/locales/pt-BR.json';
import { queryClient } from '@/lib/query-client';
import Budgets from '@/pages/Budgets';
import { budgetsService } from '@/services/budgets-service';

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

function renderBudgets() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Budgets />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Budgets page', () => {
  beforeEach(() => {
    queryClient.clear();
    mockToast.mockClear();
    mockShowConfirm.mockClear();
    vi.mocked(budgetsService.getAll).mockResolvedValue([]);
    vi.mocked(budgetsService.getStatus).mockResolvedValue([]);
  });

  it('renders page heading', async () => {
    renderBudgets();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('shows empty state when no budgets exist', async () => {
    renderBudgets();
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    // Page has rendered — no budget cards visible
    expect(screen.queryByText('R$')).not.toBeInTheDocument();
  });

  it('renders budget cards when budgets exist', async () => {
    const now = new Date();
    vi.mocked(budgetsService.getStatus).mockResolvedValue([
      {
        id: 1,
        category: 'food and drink',
        limit_amount: '500.00',
        actual_spent: '200.00',
        percentage: 40,
        status: 'ok' as const,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        member: null,
        member_name: null,
      },
    ]);
    vi.mocked(budgetsService.getAll).mockResolvedValue([
      {
        id: 1,
        uuid: 'uuid-1',
        category: 'food and drink',
        limit_amount: '500.00',
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        member: null,
        rollover_enabled: false,
        rollover_amount: '0.00',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ]);

    renderBudgets();
    await waitFor(() => {
      expect(screen.getByText(/R\$\s*200/)).toBeInTheDocument();
    });
  });

  it('opens create dialog when "Novo" button is clicked', async () => {
    const user = userEvent.setup();
    renderBudgets();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    const newButton = screen.getByRole('button', { name: /novo/i });
    await user.click(newButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('calls budgetsService.create on form submit', async () => {
    const user = userEvent.setup();
    vi.mocked(budgetsService.create).mockResolvedValue({
      id: 2,
      uuid: 'uuid-2',
      category: 'transport',
      limit_amount: '300.00',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      member: null,
      rollover_enabled: false,
      rollover_amount: '0.00',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    });

    renderBudgets();
    await waitFor(() => screen.getByRole('heading', { level: 1 }));

    const newButton = screen.getByRole('button', { name: /novo/i });
    await user.click(newButton);

    await waitFor(() => screen.getByRole('dialog'));

    // Set limit_amount via fireEvent (avoids happy-dom HTML5 required validation)
    const limitInput = screen.getByRole('spinbutton');
    fireEvent.change(limitInput, { target: { value: '300' } });

    // Submit the form directly
    const form = limitInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(budgetsService.create).toHaveBeenCalled();
    });
  });

  it('calls budgetsService.delete after confirm', async () => {
    const now = new Date();
    vi.mocked(budgetsService.getStatus).mockResolvedValue([
      {
        id: 1,
        category: 'transport',
        limit_amount: '300.00',
        actual_spent: '50.00',
        percentage: 17,
        status: 'ok' as const,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        member: null,
        member_name: null,
      },
    ]);
    vi.mocked(budgetsService.getAll).mockResolvedValue([
      {
        id: 1,
        uuid: 'uuid-1',
        category: 'transport',
        limit_amount: '300.00',
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        member: null,
        rollover_enabled: false,
        rollover_amount: '0.00',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ]);

    const user = userEvent.setup();
    renderBudgets();

    await waitFor(() => screen.getByText(/R\$\s*50/));

    const deleteButtons = screen.getAllByRole('button', {
      name: /excluir|delete|trash/i,
    });
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0]);
      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(budgetsService.delete).toHaveBeenCalledWith(1);
      });
    }
  });

  it('shows "Sugerir com IA" button', async () => {
    renderBudgets();
    await waitFor(() => screen.getByRole('heading', { level: 1 }));
    expect(screen.getByRole('button', { name: /sugerir/i })).toBeInTheDocument();
  });
});
