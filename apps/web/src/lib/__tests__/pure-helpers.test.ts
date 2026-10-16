import { describe, it, expect, vi, afterEach } from 'vitest';

import { formatCpf, formatPhone, toAccountPayload } from '@/lib/account-form';
import { axisFormatNumber, truncateLabel } from '@/lib/chart-formatters';
import { nextDueDateOnOrAfterToday } from '@/lib/debt-schedule';
import {
  getAccountBalanceInfo,
  getCurrentCreditCardBill,
  getTaskCategoryColor,
  isValidCPF,
  sortCreditCardBills,
  sumByProperty,
} from '@/lib/helpers';
import { calcCalories, optionCalories } from '@/lib/nutrition-calories';
import {
  formatGeneratedAt,
  formatReceiptDate,
  formatReceiptTime,
  generateReceiptFilename,
  getMemberDisplayName,
  mapExpenseToReceipt,
} from '@/lib/receipt-utils';
import { appearsOnDay, getPythonWeekday, getTimesForTask } from '@/lib/routine-export';
import type { Account, Expense, RoutineTask } from '@/types';
import type { MenuOption, MenuOptionIngredient } from '@/types/nutrition';
import { getErrorMessage } from '@/utils/error-utils';

afterEach(() => {
  vi.useRealTimers();
});

describe('account-form', () => {
  it('masks CPF progressively', () => {
    expect(formatCpf('123')).toBe('123');
    expect(formatCpf('1234')).toBe('123.4');
    expect(formatCpf('1234567')).toBe('123.456.7');
    expect(formatCpf('123.456.789-0999')).toBe('123.456.789-09');
  });

  it('masks phone progressively', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('11')).toBe('(11');
    expect(formatPhone('1198765')).toBe('(11) 98765');
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('strips masks from the API payload and drops confirmPassword', () => {
    expect(
      toAccountPayload({
        username: 'ana',
        password: 'x',
        confirmPassword: 'x',
        name: 'Ana',
        document: '123.456.789-09',
        phone: '(11) 98765-4321',
        email: 'a@b.c',
      })
    ).toEqual({
      username: 'ana',
      password: 'x',
      name: 'Ana',
      document: '12345678909',
      phone: '11987654321',
      email: 'a@b.c',
    });
  });
});

describe('chart-formatters', () => {
  it('abbreviates thousands and millions', () => {
    expect(axisFormatNumber(2_500_000)).toBe('2,5 mi');
    expect(axisFormatNumber(-1500)).toBe('-1,5 mil');
    expect(axisFormatNumber(999)).toBe('999');
  });

  it('truncates long labels with an ellipsis', () => {
    expect(truncateLabel('curto')).toBe('curto');
    expect(truncateLabel('abcdefghij', 5)).toBe('abcd…');
  });
});

describe('nextDueDateOnOrAfterToday', () => {
  it('keeps the due day in the current month when still ahead', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 10));
    expect(nextDueDateOnOrAfterToday('2026-01-20')).toBe('2026-10-20');
  });

  it('rolls to next month when the day already passed, clamping to month length', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 31));
    expect(nextDueDateOnOrAfterToday('2025-05-30')).toBe('2026-02-28');
  });

  it('defaults to today without a reference date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 13));
    expect(nextDueDateOnOrAfterToday()).toBe('2026-10-15');
  });
});

describe('helpers', () => {
  const account = (available: string, overdraft?: string) =>
    ({ available_balance: available, overdraft_limit: overdraft }) as Account;

  it('computes balance info including overdraft', () => {
    expect(getAccountBalanceInfo(account('100', '50'), 120)).toEqual({
      balance: 100,
      overdraft: 50,
      available: 150,
      canPay: true,
      isUsingOverdraft: true,
    });
    expect(getAccountBalanceInfo(account('10'), 20).canPay).toBe(false);
  });

  it('sums numeric and string properties, ignoring garbage', () => {
    const rows = [{ v: 1 }, { v: '2.5' }, { v: 'x' }] as unknown as { v: number }[];
    expect(sumByProperty(rows, 'v')).toBe(3.5);
  });

  it('validates CPF check digits', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
    expect(isValidCPF('52998224724')).toBe(false);
    expect(isValidCPF('111.111.111-11')).toBe(false);
    expect(isValidCPF('123')).toBe(false);
  });

  it('falls back to muted color for unknown task categories', () => {
    expect(getTaskCategoryColor('health')).toContain('bg-category-health');
    expect(getTaskCategoryColor('nope')).toContain('bg-muted');
  });

  it('sorts unpaid bills chronologically before paid ones', () => {
    const bills = [
      { year: '2026', month: 'Mar', status: 'paid' },
      { year: '2026', month: 'Feb', status: 'open' },
      { year: '2025', month: 'Dec', status: 'overdue' },
      { year: '2026', month: 'Jan', status: 'paid' },
    ] as const;
    expect(sortCreditCardBills([...bills]).map((b) => b.month)).toEqual([
      'Dec',
      'Feb',
      'Jan',
      'Mar',
    ]);
  });

  it('prefers the bill of the current month, else the oldest unpaid', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 10));
    const bills = [
      { year: '2026', month: 'Jan', status: 'open' },
      { year: '2026', month: 'Feb', status: 'open' },
    ];
    expect(getCurrentCreditCardBill(bills)?.month).toBe('Feb');
    expect(getCurrentCreditCardBill([bills[0]])?.month).toBe('Jan');
    expect(getCurrentCreditCardBill([])).toBeUndefined();
  });
});

describe('nutrition-calories', () => {
  const ing = (p: Partial<MenuOptionIngredient>) => p as MenuOptionIngredient;

  it('scales calories by quantity and returns null without food data', () => {
    expect(
      calcCalories(
        ing({
          food_calories_per_serving: '200',
          food_serving_size: '100',
          quantity: '150',
        })
      )
    ).toBe(300);
    expect(
      calcCalories(ing({ food_calories_per_serving: '200', food_serving_size: '100' }))
    ).toBe(200);
    expect(calcCalories(ing({ food_serving_size: '100' }))).toBeNull();
    expect(
      calcCalories(ing({ food_calories_per_serving: '200', food_serving_size: '0' }))
    ).toBeNull();
  });

  it('sums option calories or returns null when nothing is known', () => {
    const known = ing({ food_calories_per_serving: '100', food_serving_size: '1' });
    expect(optionCalories({ ingredients: [known, known] } as MenuOption)).toBe(200);
    expect(optionCalories({ ingredients: [ing({})] } as MenuOption)).toBeNull();
  });
});

describe('receipt-utils', () => {
  it('builds sanitized filenames for receipts and declarations', () => {
    expect(
      generateReceiptFilename('expense', 'Supermercado Pão!', '2025-01-15', 'pdf')
    ).toBe('comprovante_despesa_supermercado_pao_15-01-2025.pdf');
    expect(generateReceiptFilename('loan', 'Carro', '2025-02-01', 'png')).toBe(
      'declaracao_emprestimo_carro_01-02-2025.png'
    );
  });

  it('formats dates and times', () => {
    expect(formatReceiptDate('2025-01-15')).toBe('15/01/2025');
    expect(formatReceiptDate('')).toBe('');
    expect(formatReceiptTime('14:30:59')).toBe('14:30');
    expect(formatReceiptTime()).toBe('');
    expect(formatGeneratedAt(new Date(2025, 0, 5, 9, 7))).toBe('05/01/2025 às 09:07');
  });

  it('picks the best member display name', () => {
    expect(getMemberDisplayName('Ana', { username: 'x' })).toBe('Ana');
    expect(getMemberDisplayName(' ', { first_name: 'Bia', last_name: 'Lima' })).toBe(
      'Bia Lima'
    );
    expect(getMemberDisplayName(null, { username: 'carl' })).toBe('carl');
  });

  it('maps an expense to receipt data', () => {
    const r = mapExpenseToReceipt(
      {
        description: 'Luz',
        value: '99.90',
        date: '2025-01-15',
        payed: true,
      } as Expense,
      'Ana'
    );
    expect(r).toMatchObject({
      type: 'expense',
      value: 99.9,
      status: 'payed',
      memberName: 'Ana',
    });
  });
});

describe('routine-export', () => {
  const task = (p: Partial<RoutineTask>) =>
    ({ is_active: true, daily_occurrences: 1, ...p }) as RoutineTask;

  it('decides whether a task appears on a weekday', () => {
    expect(appearsOnDay(task({ periodicity: 'daily' }), 6)).toBe(true);
    expect(appearsOnDay(task({ periodicity: 'weekdays' }), 4)).toBe(true);
    expect(appearsOnDay(task({ periodicity: 'weekdays' }), 5)).toBe(false);
    expect(appearsOnDay(task({ periodicity: 'weekly', weekday: 2 }), 2)).toBe(true);
    expect(appearsOnDay(task({ periodicity: 'custom', custom_weekdays: [1] }), 1)).toBe(
      true
    );
    expect(appearsOnDay(task({ periodicity: 'custom' }), 1)).toBe(false);
    expect(appearsOnDay(task({ periodicity: 'monthly' }), 1)).toBe(false);
    expect(appearsOnDay(task({ periodicity: 'daily', is_active: false }), 1)).toBe(
      false
    );
  });

  it('converts JS weekday to Python weekday', () => {
    expect(getPythonWeekday(new Date(2026, 9, 12))).toBe(0); // Monday
    expect(getPythonWeekday(new Date(2026, 9, 18))).toBe(6); // Sunday
  });

  it('expands scheduled times', () => {
    expect(getTimesForTask(task({ scheduled_times: ['08:00'] }))).toEqual(['08:00']);
    expect(
      getTimesForTask(
        task({ daily_occurrences: 3, interval_hours: 8, default_time: '20:00:00' })
      )
    ).toEqual(['20:00', '04:00', '12:00']);
    expect(getTimesForTask(task({ default_time: '07:30:00' }))).toEqual(['07:30']);
    expect(getTimesForTask(task({}))).toEqual([null]);
  });
});

describe('error-utils', () => {
  it('extracts readable messages', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('plain')).toBe('plain');
    expect(getErrorMessage({ response: { status: 503 } })).toMatch(/servidor/);
    expect(getErrorMessage({ response: { status: 400 } })).toBe(
      'Ocorreu um erro inesperado.'
    );
  });
});
