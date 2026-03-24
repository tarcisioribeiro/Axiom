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
  ExportModal: () => null,
}));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ptBR from '@/i18n/locales/pt-BR.json';
import Expenses from '@/pages/Expenses';
import { expensesService } from '@/services/expenses-service';

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
    <MemoryRouter>
      <Expenses />
    </MemoryRouter>
  );
}

describe('Expenses page', () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockShowConfirm.mockClear();
    vi.mocked(expensesService.getAll).mockResolvedValue([]);
  });

  it('renders the page title', async () => {
    renderExpenses();
    await waitFor(() => {
      expect(screen.getByText(/despesas/i)).toBeInTheDocument();
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
      expect(screen.getByText('Supermercado')).toBeInTheDocument();
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
});
