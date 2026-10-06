// Service mocks — hoisted before imports
vi.mock('@/services/credit-cards-service', () => ({
  creditCardsService: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, name: 'Nubank', brand: 'mastercard' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteWithCredentials: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/credit-card-bills-service', () => ({
  creditCardBillsService: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/credit-card-installments-service', () => ({
  creditCardInstallmentsService: {
    getByBill: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/accounts-service', () => ({
  accountsService: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: 1,
        account_name: 'Conta Corrente',
        account_type: 'checking',
        balance: '2000.00',
      },
    ]),
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
  useAuthStore: () => ({
    user: { id: 1, username: 'test' },
    hasPermission: () => true,
  }),
}));

vi.mock('@/components/credit-cards/CreditCardForm', () => ({
  CreditCardForm: ({
    onSubmit,
    onCancel,
  }: {
    onSubmit: (data: Record<string, unknown>) => void;
    onCancel: () => void;
  }) => (
    <div>
      <button
        onClick={() =>
          onSubmit({
            name: 'Nubank',
            brand: 'mastercard',
            credit_limit: '5000',
            due_day: 10,
          })
        }
      >
        Salvar Cartão
      </button>
      <button onClick={onCancel}>Cancelar</button>
    </div>
  ),
}));

vi.mock('@/components/credit-cards/CreditCardBillForm', () => ({
  CreditCardBillForm: ({ onCancel }: { onCancel: () => void }) => (
    <div>
      <button onClick={onCancel}>Cancelar Fatura</button>
    </div>
  ),
}));

vi.mock('@/components/credit-cards/BillPaymentForm', () => ({
  BillPaymentForm: ({ onCancel }: { onCancel: () => void }) => (
    <div>
      <button onClick={onCancel}>Cancelar Pagamento</button>
    </div>
  ),
}));

vi.mock('@/components/receipts', () => ({
  ReceiptButton: () => null,
}));

vi.mock('@/components/common/AnimatedPage', () => ({
  AnimatedPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ptBR from '@/i18n/locales/pt-BR.json';
import { queryClient } from '@/lib/query-client';
import CreditCardManagement from '@/pages/CreditCardManagement';
import { ValidationError } from '@/services/api-errors';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardInstallmentsService } from '@/services/credit-card-installments-service';
import { creditCardsService } from '@/services/credit-cards-service';
import type { CreditCard, CreditCardBill } from '@/types';

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

function renderCreditCards() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreditCardManagement />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function makeCard(overrides: Partial<CreditCard> = {}): CreditCard {
  return {
    id: 1,
    uuid: 'uuid-1',
    name: 'Nubank',
    on_card_name: 'TARCISIO R',
    card_number_masked: '****1234',
    flag: 'mastercard',
    validation_date: '2028-01',
    credit_limit: '5000.00',
    max_limit: '5000.00',
    due_day: 10,
    closing_day: 3,
    associated_account: 1,
    is_active: true,
    available_credit: 3500,
    used_credit: 1500,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

describe('CreditCards page', () => {
  beforeEach(() => {
    queryClient.clear();
    mockToast.mockClear();
    mockShowConfirm.mockClear();
    vi.mocked(creditCardsService.deleteWithCredentials).mockClear();
    vi.mocked(creditCardsService.getAll).mockResolvedValue([]);
  });

  it('renders page heading', async () => {
    renderCreditCards();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('shows empty state when no cards exist', async () => {
    renderCreditCards();
    await waitFor(() => {
      // Page loaded — heading visible
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
    // No card items rendered
    expect(screen.queryByText(/Nubank/i)).not.toBeInTheDocument();
  });

  it('renders credit card when data exists', async () => {
    vi.mocked(creditCardsService.getAll).mockResolvedValue([makeCard()]);

    renderCreditCards();
    await waitFor(() => {
      expect(screen.getByText('Nubank')).toBeInTheDocument();
    });
  });

  it('opens create dialog on "Novo" button click', async () => {
    const user = userEvent.setup();
    renderCreditCards();

    await waitFor(() => screen.getByRole('heading', { level: 1 }));

    const newButton = screen.getByRole('button', { name: /novo/i });
    await user.click(newButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('calls creditCardsService.create on form submit', async () => {
    vi.mocked(creditCardsService.create).mockResolvedValue(makeCard({ id: 2 }));

    const user = userEvent.setup();
    renderCreditCards();

    await waitFor(() => screen.getByRole('heading', { level: 1 }));

    const newButton = screen.getByRole('button', { name: /novo/i });
    await user.click(newButton);

    await waitFor(() => screen.getByRole('dialog'));

    const saveButton = screen.getByRole('button', { name: /salvar cartão/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(creditCardsService.create).toHaveBeenCalled();
    });
  });

  it('deletes only after confirm, card number + CVV and a second confirm', async () => {
    vi.mocked(creditCardsService.getAll).mockResolvedValue([makeCard()]);
    vi.mocked(creditCardBillsService.getAll).mockResolvedValue([]);
    mockShowConfirm.mockResolvedValue(true);

    const user = userEvent.setup();
    renderCreditCards();
    await waitFor(() => screen.getByText('Nubank'));

    await user.click(screen.getAllByRole('button', { name: /excluir/i })[0]);
    await user.type(await screen.findByLabelText(/número/i), '5555444433331111');
    await user.type(screen.getByLabelText(/cvv/i), '123');
    expect(mockShowConfirm).toHaveBeenCalledTimes(1);
    expect(creditCardsService.deleteWithCredentials).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => {
      expect(creditCardsService.deleteWithCredentials).toHaveBeenCalledWith(1, {
        card_number: '5555444433331111',
        security_code: '123',
      });
    });
    expect(mockShowConfirm).toHaveBeenCalledTimes(2);
  });

  it('blocks deletion and lists unpaid bills', async () => {
    vi.mocked(creditCardsService.getAll).mockResolvedValue([makeCard()]);
    vi.mocked(creditCardBillsService.getAll).mockResolvedValue([
      {
        id: 7,
        credit_card: 1,
        month: 'Sep',
        year: '2026',
        total_amount: '100.00',
        status: 'overdue',
      } as CreditCardBill,
    ]);

    const user = userEvent.setup();
    renderCreditCards();
    await waitFor(() => screen.getByText('Nubank'));

    await user.click(screen.getAllByRole('button', { name: /excluir/i })[0]);

    expect(await screen.findByText(/faturas pendentes/i)).toBeInTheDocument();
    expect(mockShowConfirm).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/cvv/i)).not.toBeInTheDocument();
    expect(creditCardsService.deleteWithCredentials).not.toHaveBeenCalled();
  });

  it('mostra um único toast de erro com rótulos traduzidos', async () => {
    vi.mocked(creditCardsService.create).mockRejectedValue(
      new ValidationError('flag: ...', {
        flag: ['Este campo é obrigatório.'],
        validation_date: ['Data de validade deve ser posterior à data atual'],
      })
    );

    const user = userEvent.setup();
    renderCreditCards();
    await waitFor(() => screen.getByRole('heading', { level: 1 }));
    await user.click(screen.getByRole('button', { name: /novo/i }));
    await waitFor(() => screen.getByRole('dialog'));
    await user.click(screen.getByRole('button', { name: /salvar cartão/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title:
            'Não foi possível salvar. Preencha o campo Bandeira; Data de Validade: Data de validade deve ser posterior à data atual',
        })
      );
    });
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  it('abre as compras ao clicar na linha da fatura, mas não ao clicar em botão', async () => {
    localStorage.setItem('creditCardManagement.activeTab', 'bills');
    vi.mocked(creditCardsService.getAll).mockResolvedValue([makeCard()]);
    vi.mocked(creditCardBillsService.getAll).mockResolvedValue([
      {
        id: 7,
        credit_card: 1,
        month: 'Sep',
        year: '2026',
        total_amount: '100.00',
        minimum_payment: '15.00',
        paid_amount: '0.00',
        status: 'open',
      } as unknown as CreditCardBill,
    ]);

    renderCreditCards();
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /pagar/i }).length).toBeGreaterThan(
        0
      );
    });
    const rows = screen.getAllByRole('row');

    fireEvent.click(within(rows[1]).getByRole('button', { name: /pagar/i }));
    expect(screen.queryByText(/compras da fatura/i)).not.toBeInTheDocument();

    fireEvent.click(rows[1].querySelector('td')!);
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      /compras da fatura - .*\/2026/i
    );
    expect(creditCardInstallmentsService.getByBill).toHaveBeenCalledWith(7);
    localStorage.removeItem('creditCardManagement.activeTab');
  });

  it('pagina as compras da fatura em 10 por página e soma o total de todas', async () => {
    localStorage.setItem('creditCardManagement.activeTab', 'bills');
    vi.mocked(creditCardsService.getAll).mockResolvedValue([makeCard()]);
    vi.mocked(creditCardBillsService.getAll).mockResolvedValue([
      {
        id: 7,
        credit_card: 1,
        month: 'Sep',
        year: '2026',
        total_amount: '1200.00',
        minimum_payment: '15.00',
        paid_amount: '0.00',
        status: 'open',
      } as unknown as CreditCardBill,
    ]);
    vi.mocked(creditCardInstallmentsService.getByBill).mockResolvedValue(
      Array.from({ length: 12 }, (_, n) => ({
        id: n + 1,
        description: `Compra ${n + 1}`,
        value: '100.00',
        purchase_date: `2026-09-${String(n + 1).padStart(2, '0')}`,
        due_date: `2026-09-${String(n + 1).padStart(2, '0')}`,
        installment_number: 1,
        total_installments: 1,
      })) as never
    );

    renderCreditCards();
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /pagar/i }).length).toBeGreaterThan(
        0
      );
    });
    fireEvent.click(screen.getAllByRole('row')[1].querySelector('td')!);

    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(dialog).getByText('Compra 1')).toBeInTheDocument()
    );
    expect(within(dialog).getByText('Compra 10')).toBeInTheDocument();
    expect(within(dialog).queryByText('Compra 11')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/R\$\s*1\.200,00/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /próxima|próximo/i }));
    expect(await within(dialog).findByText('Compra 11')).toBeInTheDocument();
    expect(within(dialog).queryByText('Compra 1')).not.toBeInTheDocument();
    localStorage.removeItem('creditCardManagement.activeTab');
  });
});
