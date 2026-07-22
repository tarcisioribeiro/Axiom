import { API_CONFIG } from '@/config/constants';
import type { Revenue, RevenueFormData } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

export interface RevenueExportParams {
  export_format: 'csv' | 'pdf';
  date_from?: string;
  date_to?: string;
  category?: string;
  received?: string;
  search?: string;
  account?: number[];
}

class RevenuesService extends BaseService<Revenue, RevenueFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.REVENUES);
  }

  /**
   * Exporta receitas filtradas como CSV ou PDF e aciona o download no browser.
   *
   * @param params - Filtros e formato de exportação
   */
  async exportRevenues(params: RevenueExportParams): Promise<void> {
    const { account, ...rest } = params;
    const queryParams: Record<string, unknown> = { ...rest };
    if (account && account.length > 0) {
      queryParams['account'] = account;
    }

    const blob = await apiClient.getBlob(
      API_CONFIG.ENDPOINTS.REVENUES_EXPORT,
      queryParams
    );

    const date = new Date().toISOString().split('T')[0];
    const filename = `receitas_${date}.${params.export_format}`;
    triggerDownload(blob, filename);
  }
}

export const revenuesService = new RevenuesService();

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
