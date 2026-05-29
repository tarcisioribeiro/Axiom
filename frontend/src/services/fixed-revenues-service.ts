import { API_CONFIG } from '@/config/api-config';
import type {
  BulkGenerateRevenuesRequest,
  BulkGenerateRevenuesResponse,
  FixedRevenue,
  FixedRevenueFormData,
  PaginatedResponse,
} from '@/types';

import { apiClient } from './api-client';

class FixedRevenuesService {
  async getAll(): Promise<PaginatedResponse<FixedRevenue>> {
    return apiClient.get<PaginatedResponse<FixedRevenue>>(
      API_CONFIG.ENDPOINTS.FIXED_REVENUES
    );
  }

  async getById(id: number): Promise<FixedRevenue> {
    return apiClient.get<FixedRevenue>(`${API_CONFIG.ENDPOINTS.FIXED_REVENUES}${id}/`);
  }

  async create(data: FixedRevenueFormData): Promise<FixedRevenue> {
    return apiClient.post<FixedRevenue>(API_CONFIG.ENDPOINTS.FIXED_REVENUES, data);
  }

  async update(id: number, data: Partial<FixedRevenueFormData>): Promise<FixedRevenue> {
    return apiClient.patch<FixedRevenue>(
      `${API_CONFIG.ENDPOINTS.FIXED_REVENUES}${id}/`,
      data
    );
  }

  async delete(id: number): Promise<void> {
    await apiClient.delete(`${API_CONFIG.ENDPOINTS.FIXED_REVENUES}${id}/`);
  }

  async bulkGenerate(
    data: BulkGenerateRevenuesRequest
  ): Promise<BulkGenerateRevenuesResponse> {
    return apiClient.post<BulkGenerateRevenuesResponse>(
      API_CONFIG.ENDPOINTS.FIXED_REVENUES_GENERATE,
      data
    );
  }

  async getStats(): Promise<unknown> {
    return apiClient.get(API_CONFIG.ENDPOINTS.FIXED_REVENUES_STATS);
  }
}

export const fixedRevenuesService = new FixedRevenuesService();
