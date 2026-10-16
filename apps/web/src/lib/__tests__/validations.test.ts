import { describe, it, expect } from 'vitest';

import { expenseSchema } from '@/lib/validations';

const baseExpense = {
  value: 100,
  category: 'others',
  description: 'Despesa teste',
  date: '2026-08-21',
  horary: '10:00',
  payed: false,
  account: 1,
};

describe('expenseSchema — link exclusivity (requirement 8)', () => {
  it('accepts an expense with no debt/fixed-expense link', () => {
    const result = expenseSchema.safeParse(baseExpense);
    expect(result.success).toBe(true);
  });

  it('accepts an expense linked to exactly one of related_loan/related_payable', () => {
    const result = expenseSchema.safeParse({ ...baseExpense, related_payable: 5 });
    expect(result.success).toBe(true);
  });

  // Regression test: an Expense auto-generated from a FixedExpense that is
  // itself linked to a Payable/Loan carries both `fixed_expense_template`
  // and `related_payable`/`related_loan` at once (see
  // apps/api/expenses/services.py) — this is the normal, inherited state,
  // not a conflicting double link, and must not block editing/paying it.
  it('accepts an expense linked to both related_payable and fixed_expense_template', () => {
    const result = expenseSchema.safeParse({
      ...baseExpense,
      related_payable: 5,
      fixed_expense_template: 9,
    });
    expect(result.success).toBe(true);
  });

  it('accepts an expense linked to both related_loan and fixed_expense_template', () => {
    const result = expenseSchema.safeParse({
      ...baseExpense,
      related_loan: 3,
      fixed_expense_template: 9,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an expense linked to both related_loan and related_payable', () => {
    const result = expenseSchema.safeParse({
      ...baseExpense,
      related_loan: 3,
      related_payable: 5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an expense linked to related_loan and related_payable even with a fixed_expense_template', () => {
    const result = expenseSchema.safeParse({
      ...baseExpense,
      related_loan: 3,
      related_payable: 5,
      fixed_expense_template: 9,
    });
    expect(result.success).toBe(false);
  });
});
