import { apiClient } from './api-client';
import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type { Expense, ExpenseFormData } from '@/types';

/**
 * Servico para gerenciamento de despesas.
 *
 * @example
 * ```ts
 * // Listar despesas
 * const expenses = await expensesService.getAll();
 *
 * // Criar despesa
 * const expense = await expensesService.create({
 *   description: 'Aluguel',
 *   value: '1500.00',
 *   date: '2024-01-15',
 *   category: 'housing'
 * });
 *
 * // Marcar varias como pagas
 * await expensesService.bulkMarkPaid([1, 2, 3]);
 * ```
 */
class ExpensesService extends BaseService<Expense, ExpenseFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.EXPENSES);
  }

  /**
   * Marca multiplas despesas como pagas.
   *
   * @param expenseIds - Lista de IDs das despesas
   */
  async bulkMarkPaid(expenseIds: number[]): Promise<void> {
    return apiClient.post(`${this.endpoint}bulk-mark-paid/`, {
      expense_ids: expenseIds,
    });
  }
}

export const expensesService = new ExpensesService();
