// Service mocks — hoisted before imports
vi.mock('@/services/vaults-service', () => ({
  vaultsService: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    updateYield: vi.fn().mockResolvedValue({}),
    getAllTransactions: vi.fn().mockResolvedValue({ results: [], count: 0 }),
    getAllContributions: vi.fn().mockResolvedValue([]),
    simulate: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/services/accounts-service', () => ({
  accountsService: { getAll: vi.fn().mockResolvedValue([]) },
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

vi.mock('@/components/vaults/VaultCard', () => ({
  VaultCard: ({ vault }: { vault: { description: string } }) => (
    <div data-testid="vault-card">{vault.description}</div>
  ),
}));

vi.mock('@/components/vaults/VaultFormDialog', () => ({
  VaultFormDialog: ({ open }: { open: boolean }) =>
    open ? (
      <div role="dialog" data-testid="vault-form">
        Form
      </div>
    ) : null,
}));

vi.mock('@/components/vaults/VaultOperationDialogs', () => ({
  VaultDepositDialog: () => null,
  VaultWithdrawDialog: () => null,
}));

vi.mock('@/components/vaults/VaultTransactionsDialog', () => ({
  VaultTransactionsDialog: () => null,
}));

vi.mock('@/components/vaults/VaultContributionsDialog', () => ({
  VaultContributionsDialog: () => null,
}));

vi.mock('@/components/vaults/VaultGenerateDialog', () => ({
  VaultGenerateDialog: () => null,
}));

vi.mock('@/components/vaults/VaultSimulatorDialog', () => ({
  VaultSimulatorDialog: () => null,
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
import Vaults from '@/pages/Vaults';
import { vaultsService } from '@/services/vaults-service';

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

function renderVaults() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Vaults />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const sampleVault = {
  id: 1,
  uuid: 'uuid-1',
  description: 'Reserva de Emergência',
  account: 1,
  account_name: 'Conta Principal',
  current_balance: '10000.00',
  accumulated_yield: '500.00',
  yield_rate: '0.000000',
  annual_yield_rate: '0.1200',
  last_yield_date: '2026-05-01',
  is_active: true,
  notes: '',
  created_at: '2026-01-01',
  updated_at: '2026-05-01',
};

describe('Vaults page', () => {
  beforeEach(() => {
    queryClient.clear();
    mockToast.mockClear();
    mockShowConfirm.mockClear();
    vi.mocked(vaultsService.getAll).mockResolvedValue([]);
  });

  it('renders page heading', async () => {
    renderVaults();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('shows empty state message when no vaults exist', async () => {
    renderVaults();
    await waitFor(() => screen.getByRole('heading', { level: 1 }));
    expect(screen.queryByTestId('vault-card')).not.toBeInTheDocument();
  });

  it('renders vault cards when vaults exist', async () => {
    vi.mocked(vaultsService.getAll).mockResolvedValue([sampleVault]);
    renderVaults();
    await waitFor(() => {
      expect(screen.getByTestId('vault-card')).toBeInTheDocument();
      expect(screen.getByText('Reserva de Emergência')).toBeInTheDocument();
    });
  });

  it('shows warning toast when trying to create vault without accounts', async () => {
    const user = userEvent.setup();
    renderVaults();

    await waitFor(() => screen.getByRole('heading', { level: 1 }));

    const newButton = screen.getByRole('button', { name: /novo/i });
    await user.click(newButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });
});
