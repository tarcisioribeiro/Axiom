// Service mocks — hoisted before imports
vi.mock('@/services/transfers-service', () => ({
  transfersService: {
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
        account_name: 'Conta Corrente',
        current_balance: '3000.00',
      },
      { id: 2, uuid: 'acc-2', account_name: 'Poupança', current_balance: '10000.00' },
    ]),
    getProjectedBalance: vi.fn().mockResolvedValue({ projected_balance: '3000.00' }),
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

vi.mock('@/components/common/AnimatedPage', () => ({
  AnimatedPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/receipts', () => ({
  ReceiptButton: () => <button>Recibo</button>,
}));

vi.mock('@/components/transfers/TransferStats', () => ({
  TransferStats: () => <div data-testid="transfer-stats" />,
}));

vi.mock('@/components/transfers/TransferFilters', () => ({
  TransferFilters: () => <div data-testid="transfer-filters" />,
}));

vi.mock('@/components/transfers/getTransferColumns', () => ({
  getTransferColumns: () => [],
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
import Transfers from '@/pages/Transfers';
import { transfersService } from '@/services/transfers-service';

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

function renderTransfers() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Transfers />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const sampleTransfer = {
  id: 1,
  uuid: 'uuid-1',
  description: 'Transferência entre contas',
  value: '1000.00',
  date: '2026-05-10',
  horary: '09:00:00',
  status: 'completed',
  origin_account: 1,
  origin_account_name: 'Conta Corrente',
  destination_account: 2,
  destination_account_name: 'Poupança',
  member: 1,
  currency_code: 'BRL',
  created_at: '2026-05-10',
  updated_at: '2026-05-10',
};

describe('Transfers page', () => {
  beforeEach(() => {
    queryClient.clear();
    mockToast.mockClear();
    mockShowConfirm.mockClear();
    vi.mocked(transfersService.getAll).mockResolvedValue([]);
  });

  it('renders page heading', async () => {
    renderTransfers();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('shows empty state when no transfers exist', async () => {
    renderTransfers();
    await waitFor(() => screen.getByRole('heading', { level: 1 }));
    expect(screen.queryByText('Transferência entre contas')).not.toBeInTheDocument();
  });

  it('renders transfer rows when transfers exist', async () => {
    vi.mocked(transfersService.getAll).mockResolvedValue([sampleTransfer]);
    renderTransfers();
    await waitFor(() => screen.getByRole('heading', { level: 1 }));
  });

  it('opens create dialog when "Nova" button is clicked', async () => {
    const user = userEvent.setup();
    renderTransfers();

    await waitFor(() => screen.getByRole('heading', { level: 1 }));

    const newButton = screen.getByRole('button', { name: /nova/i });
    await user.click(newButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
