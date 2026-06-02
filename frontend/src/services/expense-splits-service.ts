import { API_CONFIG } from '@/config/api-config';
import type { ExpenseSplit, ExpenseSplitFormData } from '@/types';

import { apiClient } from './api-client';

class ExpenseSplitsService {
  async getAll(expenseId: number): Promise<ExpenseSplit[]> {
    const res = await apiClient.get<{ results: ExpenseSplit[] } | ExpenseSplit[]>(
      API_CONFIG.ENDPOINTS.EXPENSE_SPLITS(expenseId)
    );
    return Array.isArray(res) ? res : (res.results ?? []);
  }

  async create(expenseId: number, data: ExpenseSplitFormData): Promise<ExpenseSplit> {
    return apiClient.post<ExpenseSplit>(
      API_CONFIG.ENDPOINTS.EXPENSE_SPLITS(expenseId),
      data
    );
  }

  async update(
    expenseId: number,
    splitId: number,
    data: Partial<ExpenseSplitFormData>
  ): Promise<ExpenseSplit> {
    return apiClient.patch<ExpenseSplit>(
      `${API_CONFIG.ENDPOINTS.EXPENSE_SPLITS(expenseId)}${splitId}/`,
      data
    );
  }

  async delete(expenseId: number, splitId: number): Promise<void> {
    await apiClient.delete(
      `${API_CONFIG.ENDPOINTS.EXPENSE_SPLITS(expenseId)}${splitId}/`
    );
  }
}

export const expenseSplitsService = new ExpenseSplitsService();
