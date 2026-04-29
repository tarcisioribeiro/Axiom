// Service mocks — hoisted before imports
vi.mock('@/services/expenses-service', () => ({
  expensesService: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, description: 'Nova Despesa' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/accounts-service', () => ({
  accountsService: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: 1,
        account_name: 'Conta Corrente',
        account_type: 'checking',
        balance: '1000.00',
      },
    ]),
  },
}));

vi.mock('@/services/loans-service', () => ({
  loansService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/services/payables-service', () => ({
  payablesService: { getAll: vi.fn().mockResolvedValue([]) },
}));

const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
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

vi.mock('@/components/expenses/ExpenseForm', () => ({
  ExpenseForm: ({
    onSubmit,
    onCancel,
  }: {
    onSubmit: (data: Record<string, unknown>) => void;
    onCancel: () => void;
  }) => (
    <div>
      <button
        onClick={() =>
          onSubmit({ description: 'Test Expense', value: '100', account: 1 })
        }
      >
        Salvar Despesa
      </button>
      <button onClick={onCancel}>Cancelar</button>
    </div>
  ),
}));

vi.mock('@/components/receipts', () => ({
  ReceiptButton: () => null,
}));

vi.mock('@/components/common/ExportModal', () => ({
  ExportModal: ({
    open,
    onExport,
  }: {
    open: boolean;
    onExport: (params: { export_format: 'csv' | 'pdf' }) => Promise<void>;
  }) =>
    open ? (
      <button onClick={() => void onExport({ export_format: 'csv' })}>
        Exportar CSV
      </button>
    ) : null,
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
import Expenses from '@/pages/Expenses';
import { expensesService } from '@/services/expenses-service';

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

function renderExpenses() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Expenses />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Expenses page', () => {
  beforeEach(() => {
    queryClient.clear();
    mockToast.mockClear();
    mockShowConfirm.mockClear();
    vi.mocked(expensesService.getAll).mockResolvedValue([]);
  });

  it('renders the page title', async () => {
    renderExpenses();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('renders expense list after loading', async () => {
    vi.mocked(expensesService.getAll).mockResolvedValue([
      {
        id: 1,
        description: 'Supermercado',
        value: '150.00',
        category: 'food',
        payed: false,
        date: '2024-01-15',
        account: 1,
        account_name: 'Conta Corrente',
      } as Parameters<typeof expensesService.getAll>[0] extends undefined
        ? never
        : never,
    ] as Awaited<ReturnType<typeof expensesService.getAll>>);

    renderExpenses();

    await waitFor(() => {
      expect(screen.getAllByText('Supermercado')[0]).toBeInTheDocument();
    });
  });

  it('opens create dialog when "Nova Despesa" button is clicked', async () => {
    const user = userEvent.setup();
    renderExpenses();

    // Wait for accounts to load (they exist so dialog can open)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /nova despesa/i })).not.toBeNull();
    });

    const newBtn = screen.getByRole('button', { name: /nova despesa/i });
    await user.click(newBtn);

    expect(screen.getByText('Salvar Despesa')).toBeInTheDocument();
  });

  it('shows error toast when creating expense without accounts', async () => {
    const { accountsService } = await import('@/services/accounts-service');
    vi.mocked(accountsService.getAll).mockResolvedValue([]);

    const user = userEvent.setup();
    renderExpenses();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /nova despesa/i })).not.toBeNull();
    });

    // Wait for accounts to finish loading (empty)
    await waitFor(() => {
      expect(accountsService.getAll).toHaveBeenCalled();
    });

    const newBtn = screen.getByRole('button', { name: /nova despesa/i });
    await user.click(newBtn);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );

    // Restore default mock for other tests
    vi.mocked(accountsService.getAll).mockResolvedValue([
      {
        id: 1,
        account_name: 'Conta Corrente',
        account_type: 'checking',
        balance: '1000.00',
      },
    ] as Awaited<ReturnType<typeof accountsService.getAll>>);
  });

  it('calls expensesService.create on form submission', async () => {
    const user = userEvent.setup();
    renderExpenses();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /nova despesa/i })).not.toBeNull();
    });

    const newBtn = screen.getByRole('button', { name: /nova despesa/i });
    await user.click(newBtn);

    const saveBtn = await screen.findByText('Salvar Despesa');
    await user.click(saveBtn);

    expect(expensesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Test Expense' })
    );
  });

  it('opens export modal when export button is clicked', async () => {
    const user = userEvent.setup();
    renderExpenses();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /exportar/i })).not.toBeNull();
    });

    const exportBtn = screen.getByRole('button', { name: /exportar/i });
    await user.click(exportBtn);
    // ExportModal is mocked to render null — just verify no crash
    expect(exportBtn).toBeInTheDocument();
  });

  it('opens edit dialog when edit button is clicked on an expense', async () => {
    const mockExpense = {
      id: 99,
      uuid: 'abc-123',
      description: 'Mercado Teste',
      value: '200.00',
      date: '2024-03-10',
      horary: '08:00:00',
      category: 'food',
      payed: false,
      account: 1,
      account_name: 'Conta Corrente',
      member: null,
      auto_categorized: false,
      created_at: '2024-03-10T08:00:00Z',
      updated_at: '2024-03-10T08:00:00Z',
    };
    vi.mocked(expensesService.getAll).mockResolvedValue([mockExpense] as Awaited<
      ReturnType<typeof expensesService.getAll>
    >);

    const user = userEvent.setup();
    renderExpenses();

    await waitFor(() => {
      expect(screen.getAllByText('Mercado Teste')[0]).toBeInTheDocument();
    });

    const editBtns = screen.getAllByRole('button', { name: /editar/i });
    await user.click(editBtns[0]);

    // Dialog opens in edit mode — "Salvar Despesa" button visible via mock form
    expect(screen.getByText('Salvar Despesa')).toBeInTheDocument();
  });

  it('calls expensesService.delete when delete is confirmed', async () => {
    const mockExpense = {
      id: 42,
      uuid: 'del-456',
      description: 'Despesa Deletar',
      value: '50.00',
      date: '2024-03-15',
      horary: '09:00:00',
      category: 'other',
      payed: false,
      account: 1,
      account_name: 'Conta Corrente',
      member: null,
      auto_categorized: false,
      created_at: '2024-03-15T09:00:00Z',
      updated_at: '2024-03-15T09:00:00Z',
    };
    vi.mocked(expensesService.getAll).mockResolvedValue([mockExpense] as Awaited<
      ReturnType<typeof expensesService.getAll>
    >);
    vi.mocked(expensesService.delete).mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderExpenses();

    await waitFor(() => {
      expect(screen.getAllByText('Despesa Deletar')[0]).toBeInTheDocument();
    });

    const deleteBtns = screen.getAllByRole('button', { name: /excluir/i });
    await user.click(deleteBtns[0]);

    await waitFor(() => {
      expect(expensesService.delete).toHaveBeenCalledWith(42);
    });
  });

  it('shows error toast when creating expense fails', async () => {
    vi.mocked(expensesService.create).mockRejectedValueOnce(new Error('Create error'));
    const user = userEvent.setup();
    renderExpenses();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /nova despesa/i })).not.toBeNull();
    });

    await user.click(screen.getByRole('button', { name: /nova despesa/i }));
    const saveBtn = await screen.findByText('Salvar Despesa');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });

  it('shows error toast when updating expense fails', async () => {
    const mockExpense = {
      id: 77,
      uuid: 'err-upd',
      description: 'Erro Edição',
      value: '30.00',
      date: '2024-05-01',
      horary: '11:00:00',
      category: 'other',
      payed: false,
      account: 1,
      account_name: 'Conta Corrente',
      member: null,
      auto_categorized: false,
      created_at: '2024-05-01T11:00:00Z',
      updated_at: '2024-05-01T11:00:00Z',
    };
    vi.mocked(expensesService.getAll).mockResolvedValue([mockExpense] as Awaited<
      ReturnType<typeof expensesService.getAll>
    >);
    vi.mocked(expensesService.update).mockRejectedValueOnce(new Error('Update error'));

    const user = userEvent.setup();
    renderExpenses();

    await waitFor(() => {
      expect(screen.getAllByText('Erro Edição')[0]).toBeInTheDocument();
    });

    const editBtns = screen.getAllByRole('button', { name: /editar/i });
    await user.click(editBtns[0]);
    const saveBtn = await screen.findByText('Salvar Despesa');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });

  it('shows error toast when deleting expense fails', async () => {
    const mockExpense = {
      id: 88,
      uuid: 'err-del',
      description: 'Erro Exclusão',
      value: '20.00',
      date: '2024-06-01',
      horary: '12:00:00',
      category: 'other',
      payed: false,
      account: 1,
      account_name: 'Conta Corrente',
      member: null,
      auto_categorized: false,
      created_at: '2024-06-01T12:00:00Z',
      updated_at: '2024-06-01T12:00:00Z',
    };
    vi.mocked(expensesService.getAll).mockResolvedValue([mockExpense] as Awaited<
      ReturnType<typeof expensesService.getAll>
    >);
    vi.mocked(expensesService.delete).mockRejectedValueOnce(new Error('Delete error'));

    const user = userEvent.setup();
    renderExpenses();

    await waitFor(() => {
      expect(screen.getAllByText('Erro Exclusão')[0]).toBeInTheDocument();
    });

    const deleteBtns = screen.getAllByRole('button', { name: /excluir/i });
    await user.click(deleteBtns[0]);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });

  it('cancels the expense dialog when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderExpenses();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /nova despesa/i })).not.toBeNull();
    });

    await user.click(screen.getByRole('button', { name: /nova despesa/i }));
    expect(screen.getByText('Salvar Despesa')).toBeInTheDocument();

    await user.click(screen.getByText('Cancelar'));
    await waitFor(() => {
      expect(screen.queryByText('Salvar Despesa')).not.toBeInTheDocument();
    });
  });

  it('calls expensesService.update when editing an existing expense', async () => {
    const mockExpense = {
      id: 55,
      uuid: 'upd-789',
      description: 'Editar Teste',
      value: '75.00',
      date: '2024-04-01',
      horary: '10:00:00',
      category: 'other',
      payed: false,
      account: 1,
      account_name: 'Conta Corrente',
      member: null,
      auto_categorized: false,
      created_at: '2024-04-01T10:00:00Z',
      updated_at: '2024-04-01T10:00:00Z',
    };
    vi.mocked(expensesService.getAll).mockResolvedValue([mockExpense] as Awaited<
      ReturnType<typeof expensesService.getAll>
    >);
    vi.mocked(expensesService.update).mockResolvedValue(
      mockExpense as Awaited<ReturnType<typeof expensesService.update>>
    );

    const user = userEvent.setup();
    renderExpenses();

    await waitFor(() => {
      expect(screen.getAllByText('Editar Teste')[0]).toBeInTheDocument();
    });

    const editBtns = screen.getAllByRole('button', { name: /editar/i });
    await user.click(editBtns[0]);

    const saveBtn = await screen.findByText('Salvar Despesa');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(expensesService.update).toHaveBeenCalledWith(
        55,
        expect.objectContaining({ description: 'Test Expense' })
      );
    });
  });

  it('triggers export flow when ExportModal calls onExport', async () => {
    const { expensesService: es } = await import('@/services/expenses-service');
    vi.mocked(es).exportExpenses = vi.fn().mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderExpenses();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /exportar/i })).not.toBeNull();
    });

    // Open the export modal
    await user.click(screen.getAllByRole('button', { name: /exportar/i })[0]);

    // The mocked ExportModal shows "Exportar CSV" button when open
    const exportCsvBtn = await screen.findByText('Exportar CSV');
    await user.click(exportCsvBtn);

    await waitFor(() => {
      expect(es.exportExpenses).toHaveBeenCalledWith(
        expect.objectContaining({ export_format: 'csv' })
      );
    });
  });
});
