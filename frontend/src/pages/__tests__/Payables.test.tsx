// Service mocks — hoisted before imports
vi.mock('@/services/payables-service', () => ({
  payablesService: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/accounts-service', () => ({
  accountsService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/services/members-service', () => ({
  membersService: {
    getAll: vi.fn().mockResolvedValue([]),
    getCurrentUserMember: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/services/payable-installments-service', () => ({
  payableInstallmentsService: {
    getAll: vi.fn().mockResolvedValue([]),
    pay: vi.fn().mockResolvedValue({}),
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
import Payables from '@/pages/Payables';
import { payablesService } from '@/services/payables-service';

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

function renderPayables() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Payables />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const samplePayable = {
  id: 1,
  uuid: 'uuid-1',
  description: 'Conta de luz',
  value: '350.00',
  paid_value: '0.00',
  due_date: '2026-06-10',
  payment_date: null,
  category: 'utilities',
  status: 'active',
  account: 1,
  account_name: 'Conta Principal',
  member: 1,
  member_name: 'João',
  installments: 1,
  frequency: 'once',
  notes: '',
  created_at: '2026-05-01',
  updated_at: '2026-05-01',
};

describe('Payables page', () => {
  beforeEach(() => {
    queryClient.clear();
    mockToast.mockClear();
    mockShowConfirm.mockClear();
    vi.mocked(payablesService.getAll).mockResolvedValue([]);
  });

  it('renders page heading', async () => {
    renderPayables();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('shows empty state when no payables exist', async () => {
    renderPayables();
    await waitFor(() => screen.getByRole('heading', { level: 1 }));
    expect(screen.queryByText('Conta de luz')).not.toBeInTheDocument();
  });

  it('renders payable cards when payables exist', async () => {
    vi.mocked(payablesService.getAll).mockResolvedValue([samplePayable]);
    renderPayables();
    await waitFor(() => {
      expect(screen.getByText('Conta de luz')).toBeInTheDocument();
    });
  });

  it('opens create dialog when "Novo" button is clicked', async () => {
    const user = userEvent.setup();
    renderPayables();

    await waitFor(() => screen.getByRole('heading', { level: 1 }));

    const newButton = screen.getByRole('button', { name: /novo/i });
    await user.click(newButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('calls payablesService.delete after confirm', async () => {
    vi.mocked(payablesService.getAll).mockResolvedValue([samplePayable]);
    const user = userEvent.setup();
    renderPayables();

    await waitFor(() => screen.getByText('Conta de luz'));

    const deleteButtons = screen.getAllByRole('button', {
      name: /excluir|delete|trash/i,
    });
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0]);
      await waitFor(() => expect(mockShowConfirm).toHaveBeenCalled());
      await waitFor(() => expect(payablesService.delete).toHaveBeenCalledWith(1));
    }
  });
});
