import { API_CONFIG } from '@/config/api-config';
import type { FixedTransfer, FixedTransferFormData, PaginatedResponse } from '@/types';

import { apiClient } from './api-client';

class FixedTransfersService {
  async getAll(): Promise<PaginatedResponse<FixedTransfer>> {
    return apiClient.get<PaginatedResponse<FixedTransfer>>(
      API_CONFIG.ENDPOINTS.FIXED_TRANSFERS
    );
  }

  async getById(id: number): Promise<FixedTransfer> {
    return apiClient.get<FixedTransfer>(
      `${API_CONFIG.ENDPOINTS.FIXED_TRANSFERS}${id}/`
    );
  }

  async create(data: FixedTransferFormData): Promise<FixedTransfer> {
    return apiClient.post<FixedTransfer>(API_CONFIG.ENDPOINTS.FIXED_TRANSFERS, data);
  }

  async update(
    id: number,
    data: Partial<FixedTransferFormData>
  ): Promise<FixedTransfer> {
    return apiClient.patch<FixedTransfer>(
      `${API_CONFIG.ENDPOINTS.FIXED_TRANSFERS}${id}/`,
      data
    );
  }

  async delete(id: number): Promise<void> {
    await apiClient.delete(`${API_CONFIG.ENDPOINTS.FIXED_TRANSFERS}${id}/`);
  }

  async generate(month: string): Promise<unknown> {
    return apiClient.post(API_CONFIG.ENDPOINTS.FIXED_TRANSFERS_GENERATE, { month });
  }
}

export const fixedTransfersService = new FixedTransfersService();
