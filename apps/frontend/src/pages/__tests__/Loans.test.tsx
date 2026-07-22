// Service mocks — hoisted before imports
vi.mock('@/services/loans-service', () => ({
  loansService: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/accounts-service', () => ({
  accountsService: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: 1,
        uuid: 'acc-1',
        account_name: 'Conta Principal',
        institution_name: 'Banco',
        current_balance: '5000.00',
      },
    ]),
  },
}));

vi.mock('@/services/members-service', () => ({
  membersService: {
    getAll: vi
      .fn()
      .mockResolvedValue([{ id: 1, uuid: 'mem-1', name: 'João', is_primary: true }]),
    getCurrentUserMember: vi
      .fn()
      .mockResolvedValue({ id: 1, uuid: 'mem-1', name: 'João' }),
  },
}));

vi.mock('@/services/expenses-service', () => ({
  expensesService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/services/revenues-service', () => ({
  revenuesService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/services/loan-installments-service', () => ({
  loanInstallmentsService: {
    getAll: vi.fn().mockResolvedValue([]),
    getAmortizationSchedule: vi.fn().mockResolvedValue({ schedule: [] }),
  },
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

vi.mock('@/components/receipts', () => ({
  ReceiptButton: () => <button>Recibo</button>,
}));

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ptBR from '@/i18n/locales/pt-BR.json';
import { queryClient } from '@/lib/query-client';
import Loans from '@/pages/Loans';
import { loansService } from '@/services/loans-service';

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

function renderLoans() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Loans />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const sampleLoan = {
  id: 1,
  uuid: 'uuid-1',
  description: 'Empréstimo pessoal',
  value: '5000.00',
  payed_value: '1000.00',
  date: '2026-01-15',
  horary: '10:00:00',
  category: 'personal',
  status: 'active',
  account: 1,
  account_name: 'Conta Principal',
  benefited: 1,
  benefited_name: 'João',
  creditor: 2,
  creditor_name: 'Banco',
  installments: 12,
  frequency: 'monthly',
  interest_rate: '2.00',
  notes: '',
  created_at: '2026-01-15',
  updated_at: '2026-01-15',
};

describe('Loans page', () => {
  beforeEach(() => {
    queryClient.clear();
    mockToast.mockClear();
    mockShowConfirm.mockClear();
    vi.mocked(loansService.getAll).mockResolvedValue([]);
  });

  it('renders page heading', async () => {
    renderLoans();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('shows empty state when no loans exist', async () => {
    renderLoans();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
    expect(screen.queryByText('Empréstimo pessoal')).not.toBeInTheDocument();
  });

  it('renders loan cards when loans exist', async () => {
    vi.mocked(loansService.getAll).mockResolvedValue([sampleLoan]);
    renderLoans();
    await waitFor(() => {
      expect(screen.getByText('Empréstimo pessoal')).toBeInTheDocument();
    });
  });

  it('opens create dialog when "Novo" button is clicked', async () => {
    const user = userEvent.setup();
    renderLoans();

    await waitFor(() => screen.getByRole('heading', { level: 1 }));

    const newButton = screen.getByRole('button', { name: /novo/i });
    await user.click(newButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('calls loansService.delete after confirm', async () => {
    vi.mocked(loansService.getAll).mockResolvedValue([sampleLoan]);
    const user = userEvent.setup();
    renderLoans();

    await waitFor(() => screen.getByText('Empréstimo pessoal'));

    const deleteButtons = screen.getAllByRole('button', {
      name: /excluir|delete|trash/i,
    });
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0]);
      await waitFor(() => expect(mockShowConfirm).toHaveBeenCalled());
      await waitFor(() => expect(loansService.delete).toHaveBeenCalledWith(1));
    }
  });
});
