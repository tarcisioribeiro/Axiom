// Service mocks — hoisted before imports
vi.mock('@/services/credit-cards-service', () => ({
  creditCardsService: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, name: 'Nubank', brand: 'mastercard' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ptBR from '@/i18n/locales/pt-BR.json';
import { queryClient } from '@/lib/query-client';
import CreditCards from '@/pages/CreditCards';
import { creditCardsService } from '@/services/credit-cards-service';
import type { CreditCard } from '@/types';

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
        <CreditCards />
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

  it('calls creditCardsService.delete after confirm', async () => {
    vi.mocked(creditCardsService.getAll).mockResolvedValue([makeCard()]);

    const user = userEvent.setup();
    renderCreditCards();

    await waitFor(() => screen.getByText('Nubank'));

    const deleteButtons = screen.getAllByRole('button', {
      name: /excluir|delete|trash/i,
    });
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0]);
      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(creditCardsService.delete).toHaveBeenCalledWith(1);
      });
    }
  });
});
