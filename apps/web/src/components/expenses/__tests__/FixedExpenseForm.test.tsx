import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { FixedExpenseForm } from '@/components/expenses/FixedExpenseForm';
import type { Account, CreditCard, FixedExpense } from '@/types';

vi.mock('@/services/members-service', () => ({
  membersService: { getCurrentUserMember: vi.fn().mockResolvedValue({ id: 1 }) },
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

const accounts = [{ id: 1, account_name: 'Conta Corrente' }] as Account[];
const creditCards = [
  { id: 10, name: 'Cartão A', on_card_name: 'FULANO' },
  { id: 20, name: 'Cartão B', on_card_name: 'FULANO' },
] as CreditCard[];

const fixedExpense = {
  id: 5,
  description: 'Streaming',
  default_value: '39.90',
  category: 'digital signs',
  credit_card: 20,
  due_day: 10,
  is_active: true,
  allow_value_edit: true,
} as FixedExpense;

describe('FixedExpenseForm (edição)', () => {
  it('carrega categoria e cartão salvos', async () => {
    render(
      <FixedExpenseForm
        fixedExpense={fixedExpense}
        accounts={accounts}
        creditCards={creditCards}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    await waitFor(() => {
      const triggers = screen.getAllByRole('combobox').map((el) => el.textContent);
      expect(triggers.some((t) => t?.includes('Cartão B'))).toBe(true);
      expect(triggers.some((t) => t?.includes('Assinaturas Digitais'))).toBe(true);
    });
  });
});
