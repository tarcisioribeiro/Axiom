/**
 * Funções Auxiliares
 *
 * Funções utilitárias para cálculos, manipulação de arrays e outras operações comuns.
 */

import { translate } from '@/config/constants';
import type { Account, CreditCardBill } from '@/types';

export interface AccountBalanceInfo {
  balance: number;
  overdraft: number;
  available: number;
  canPay: boolean;
  isUsingOverdraft: boolean;
}

export const getAccountBalanceInfo = (
  account: Account,
  amount: number
): AccountBalanceInfo => {
  const balance = parseFloat(account.available_balance);
  const overdraft = parseFloat(account.overdraft_limit ?? '0');
  const available = balance + overdraft;
  return {
    balance,
    overdraft,
    available,
    canPay: available >= amount,
    isUsingOverdraft: balance < amount && available >= amount,
  };
};

/**
 * Traduz categoria de despesa ou receita de forma conveniente
 *
 * @param category - Categoria em inglês
 * @param type - Tipo ('expense' ou 'revenue')
 * @returns Categoria traduzida em português
 *
 * @example
 * translateCategory('food and drink', 'expense') // "Comida e Bebida"
 * translateCategory('salary', 'revenue') // "Salário"
 */
export const translateCategory = (
  category: string,
  type: 'expense' | 'revenue'
): string => {
  const categoryKey = type === 'expense' ? 'expenseCategories' : 'revenueCategories';
  return translate(categoryKey, category);
};

/**
 * Soma valores de uma propriedade em um array
 *
 * @param array - Array de objetos
 * @param property - Propriedade numérica a somar
 * @returns Soma total
 *
 * @example
 * sumByProperty([{value: 100}, {value: 200}, {value: 50}], 'value') // 350
 */
export const sumByProperty = <T>(array: T[], property: keyof T): number => {
  return array.reduce((sum, item) => {
    const value = item[property];
    return sum + (typeof value === 'number' ? value : parseFloat(String(value)) || 0);
  }, 0);
};

/**
 * Valida CPF
 *
 * @param cpf - CPF a ser validado (com ou sem formatação)
 * @returns true se CPF é válido
 *
 * @example
 * isValidCPF('123.456.789-09') // true ou false
 * isValidCPF('12345678909') // true ou false
 */
export const isValidCPF = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, '');

  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false; // Rejeita números repetidos

  let sum = 0;
  let remainder;

  // Valida primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.substring(9, 10))) return false;

  sum = 0;
  // Valida segundo dígito verificador
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.substring(10, 11))) return false;

  return true;
};

/**
 * Retorna cor de badge para categoria de tarefa rotineira/bloco de foco
 *
 * @param category - Categoria da tarefa ('health', 'intellect', etc.)
 * @returns Classe CSS do Tailwind para cor do badge
 */
export const getTaskCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    health: 'bg-category-health text-white dark:text-black border-transparent',
    intellect: 'bg-category-studies text-white dark:text-black border-transparent',
    spiritual: 'bg-category-spiritual text-white dark:text-black border-transparent',
    exercise: 'bg-category-exercise text-white dark:text-black border-transparent',
    nutrition: 'bg-category-nutrition text-white dark:text-black border-transparent',
    work: 'bg-category-work text-white dark:text-black border-transparent',
    social: 'bg-category-leisure text-white dark:text-black border-transparent',
    finance: 'bg-category-finance text-white dark:text-black border-transparent',
    household: 'bg-category-nutrition text-white dark:text-black border-transparent',
    personal_care: 'bg-category-health text-white dark:text-black border-transparent',
    other: 'bg-muted text-muted-foreground border-transparent',
  };
  return colors[category] || 'bg-muted text-muted-foreground border-transparent';
};

const BILL_MONTH_ORDER: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

const getBillTimestamp = (bill: Pick<CreditCardBill, 'year' | 'month'>): number =>
  new Date(parseInt(bill.year), (BILL_MONTH_ORDER[bill.month] ?? 1) - 1).getTime();

/**
 * Ordena faturas de cartão de crédito: não pagas em ordem cronológica
 * crescente (a fatura aberta do mês atual fica primeiro), com as faturas
 * pagas agrupadas ao final da lista.
 */
export const sortCreditCardBills = <
  T extends Pick<CreditCardBill, 'year' | 'month' | 'status'>,
>(
  bills: T[]
): T[] => {
  const notPaid = bills
    .filter((b) => b.status !== 'paid')
    .sort((a, b) => getBillTimestamp(a) - getBillTimestamp(b));
  const paid = bills
    .filter((b) => b.status === 'paid')
    .sort((a, b) => getBillTimestamp(a) - getBillTimestamp(b));
  return [...notPaid, ...paid];
};

/**
 * Retorna a fatura atual (a fatura do mês corrente) dentre as faturas de
 * um cartão. Prioriza a fatura cujo ano/mês corresponde ao mês corrente
 * real — mesmo que uma fatura antiga tenha ficado presa em status "aberta"
 * (ex.: fechamento automático que não rodou) — e só recorre à fatura não
 * paga mais antiga como fallback quando a fatura do mês atual ainda não
 * foi gerada.
 */
export const getCurrentCreditCardBill = <
  T extends Pick<CreditCardBill, 'year' | 'month' | 'status'>,
>(
  bills: T[]
): T | undefined => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const exactMatch = bills.find(
    (b) =>
      (BILL_MONTH_ORDER[b.month] ?? 1) === currentMonth &&
      parseInt(b.year, 10) === currentYear
  );
  if (exactMatch) return exactMatch;
  return sortCreditCardBills(bills).find((b) => b.status !== 'paid');
};
