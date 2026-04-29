vi.mock('@/services/accounts-service', () => ({
  accountsService: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: 1,
        account_name: 'Conta Corrente',
        account_type: 'checking',
        institution: 'bradesco',
        account_number_masked: '****1234',
        balance: '2500.00',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        account_name: 'Poupança',
        account_type: 'savings',
        institution: 'itau',
        account_number_masked: '****5678',
        balance: '5000.00',
        created_at: '2024-01-01T00:00:00Z',
      },
    ]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/bank-reconciliation-service', () => ({
  bankReconciliationService: {
    getAll: vi.fn().mockResolvedValue([]),
    importFile: vi.fn().mockResolvedValue({ id: 1 }),
    runMatch: vi.fn().mockResolvedValue({ id: 1 }),
  },
}));

const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

const { mockShowConfirm } = vi.hoisted(() => ({
  mockShowConfirm: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/hooks/use-alert-dialog', () => ({
  useAlertDialog: () => ({ showConfirm: mockShowConfirm }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/components/accounts/AccountForm', () => ({
  AccountForm: ({
    onSubmit,
    onCancel,
  }: {
    onSubmit: (data: Record<string, unknown>) => void;
    onCancel: () => void;
  }) => (
    <div>
      <span>AccountForm</span>
      <button
        onClick={() =>
          onSubmit({ account_name: 'Conta Editada', account_type: 'checking' })
        }
      >
        Salvar Conta
      </button>
      <button onClick={onCancel}>Cancelar</button>
    </div>
  ),
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
import Accounts from '@/pages/Accounts';
import { accountsService } from '@/services/accounts-service';

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

function renderAccounts() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Accounts />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Accounts page', () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockShowConfirm.mockClear().mockResolvedValue(false);
    queryClient.clear();
  });

  it('renders the page title', async () => {
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('renders account list after loading', async () => {
    renderAccounts();

    await waitFor(() => {
      expect(screen.getAllByText('Conta Corrente')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Poupança')[0]).toBeInTheDocument();
    });
  });

  it('renders new account button', async () => {
    renderAccounts();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nova conta/i })).toBeInTheDocument();
    });
  });

  it('opens create dialog when "Nova Conta" button is clicked', async () => {
    const user = userEvent.setup();
    renderAccounts();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nova conta/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /nova conta/i }));

    expect(screen.getByText('AccountForm')).toBeInTheDocument();
  });

  it('shows delete confirmation dialog when delete button is clicked', async () => {
    const user = userEvent.setup();
    renderAccounts();

    await waitFor(() => {
      expect(screen.getAllByText('Conta Corrente')[0]).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
    await user.click(deleteButtons[0]);

    expect(mockShowConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('does not call accountsService.delete when confirmation is cancelled', async () => {
    mockShowConfirm.mockResolvedValue(false);
    const user = userEvent.setup();
    renderAccounts();

    await waitFor(() => {
      expect(screen.getAllByText('Conta Corrente')[0]).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalled();
    });

    expect(accountsService.delete).not.toHaveBeenCalled();
  });

  it('calls accountsService.delete when delete is confirmed', async () => {
    mockShowConfirm.mockResolvedValue(true);
    const user = userEvent.setup();
    renderAccounts();

    await waitFor(() => {
      expect(screen.getAllByText('Conta Corrente')[0]).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(accountsService.delete).toHaveBeenCalledWith(1);
    });
  });

  it('opens edit dialog with form when edit button is clicked', async () => {
    const user = userEvent.setup();
    renderAccounts();

    await waitFor(() => {
      expect(screen.getAllByText('Conta Corrente')[0]).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /editar/i });
    await user.click(editButtons[0]);

    expect(screen.getByText('AccountForm')).toBeInTheDocument();
  });

  it('calls accountsService.create when creating new account', async () => {
    const user = userEvent.setup();
    renderAccounts();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nova conta/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /nova conta/i }));
    const saveBtn = await screen.findByText('Salvar Conta');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(accountsService.create).toHaveBeenCalled();
    });
  });

  it('calls accountsService.update when editing an existing account', async () => {
    const user = userEvent.setup();
    renderAccounts();

    await waitFor(() => {
      expect(screen.getAllByText('Conta Corrente')[0]).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /editar/i });
    await user.click(editButtons[0]);

    const saveBtn = await screen.findByText('Salvar Conta');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(accountsService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ account_name: 'Conta Editada' })
      );
    });
  });

  it('cancels dialog when Cancelar is clicked', async () => {
    const user = userEvent.setup();
    renderAccounts();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nova conta/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /nova conta/i }));
    expect(screen.getByText('AccountForm')).toBeInTheDocument();

    await user.click(screen.getByText('Cancelar'));
    await waitFor(() => {
      expect(screen.queryByText('AccountForm')).not.toBeInTheDocument();
    });
  });

  it('shows error toast when creating account fails', async () => {
    vi.mocked(accountsService.create).mockRejectedValueOnce(new Error('Server error'));
    const user = userEvent.setup();
    renderAccounts();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nova conta/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /nova conta/i }));
    const saveBtn = await screen.findByText('Salvar Conta');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });

  it('shows error toast when updating account fails', async () => {
    vi.mocked(accountsService.update).mockRejectedValueOnce(new Error('Server error'));
    const user = userEvent.setup();
    renderAccounts();

    await waitFor(() => {
      expect(screen.getAllByText('Conta Corrente')[0]).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /editar/i });
    await user.click(editButtons[0]);
    const saveBtn = await screen.findByText('Salvar Conta');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });

  it('shows error toast when deleting account fails', async () => {
    mockShowConfirm.mockResolvedValue(true);
    vi.mocked(accountsService.delete).mockRejectedValueOnce(new Error('Server error'));
    const user = userEvent.setup();
    renderAccounts();

    await waitFor(() => {
      expect(screen.getAllByText('Conta Corrente')[0]).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });

  it('shows error toast when loading reconciliation imports fails', async () => {
    const { bankReconciliationService } =
      await import('@/services/bank-reconciliation-service');
    vi.mocked(bankReconciliationService.getAll).mockRejectedValueOnce(
      new Error('Load error')
    );
    const user = userEvent.setup();
    renderAccounts();

    await waitFor(() => {
      expect(screen.getAllByText('Conta Corrente')[0]).toBeInTheDocument();
    });

    const reconcileButtons = screen.getAllByRole('button', {
      name: /concilia/i,
    });
    await user.click(reconcileButtons[0]);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });

    // Restore mock
    vi.mocked(bankReconciliationService.getAll).mockResolvedValue([]);
  });

  it('opens bank reconciliation dialog when reconciliation button is clicked', async () => {
    const user = userEvent.setup();
    renderAccounts();

    await waitFor(() => {
      expect(screen.getAllByText('Conta Corrente')[0]).toBeInTheDocument();
    });

    const reconcileButtons = screen.getAllByRole('button', {
      name: /concilia/i,
    });
    await user.click(reconcileButtons[0]);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /importar extrato/i })
      ).toBeInTheDocument();
    });
  });
});
