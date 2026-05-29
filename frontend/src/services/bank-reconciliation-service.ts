import { API_CONFIG } from '@/config/constants';
import type { BankStatementEntry, BankStatementImport } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class BankReconciliationService extends BaseService<BankStatementImport, FormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.BANK_RECONCILIATION_IMPORTS_LIST);
  }

  async importFile(formData: FormData): Promise<BankStatementImport> {
    return apiClient.post<BankStatementImport>(
      API_CONFIG.ENDPOINTS.BANK_RECONCILIATION_IMPORTS,
      formData
    );
  }

  async getImport(importId: number): Promise<BankStatementImport> {
    return apiClient.get<BankStatementImport>(
      `${API_CONFIG.ENDPOINTS.BANK_RECONCILIATION_IMPORTS}${importId}/`
    );
  }

  async runMatch(importId: number): Promise<BankStatementImport> {
    return apiClient.post<BankStatementImport>(
      `${API_CONFIG.ENDPOINTS.BANK_RECONCILIATION_IMPORTS}${importId}/match/`
    );
  }

  async updateEntry(
    entryId: number,
    data: Partial<
      Pick<BankStatementEntry, 'status' | 'matched_expense' | 'matched_revenue'>
    >
  ): Promise<BankStatementEntry> {
    return apiClient.patch<BankStatementEntry>(
      `${API_CONFIG.ENDPOINTS.BANK_RECONCILIATION_ENTRIES}${entryId}/`,
      data
    );
  }

  async manualMatch(
    importId: number,
    entryId: number,
    data: { matched_expense_id?: number | null; matched_revenue_id?: number | null }
  ): Promise<BankStatementEntry> {
    return apiClient.patch<BankStatementEntry>(
      `${API_CONFIG.ENDPOINTS.BANK_RECONCILIATION_IMPORTS}${importId}/entries/${entryId}/match/`,
      data
    );
  }
}

export const bankReconciliationService = new BankReconciliationService();
