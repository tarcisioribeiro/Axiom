import { API_CONFIG } from '@/config/constants';
import type { Expense, ExpenseFormData } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

export interface ExpenseExportParams {
  export_format: 'csv' | 'pdf';
  date_from?: string;
  date_to?: string;
  category?: string;
  payed?: string;
  search?: string;
  account?: number[];
}

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

  /**
   * Exporta despesas filtradas como CSV ou PDF e aciona o download no browser.
   *
   * @param params - Filtros e formato de exportação
   */
  async exportExpenses(params: ExpenseExportParams): Promise<void> {
    const { account, ...rest } = params;
    // axios serializes repeated keys as array when value is array
    const queryParams: Record<string, unknown> = { ...rest };
    if (account && account.length > 0) {
      queryParams['account'] = account;
    }

    const blob = await apiClient.getBlob(
      API_CONFIG.ENDPOINTS.EXPENSES_EXPORT,
      queryParams
    );

    const date = new Date().toISOString().split('T')[0];
    const filename = `despesas_${date}.${params.export_format}`;
    triggerDownload(blob, filename);
  }
}

export const expensesService = new ExpensesService();

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
