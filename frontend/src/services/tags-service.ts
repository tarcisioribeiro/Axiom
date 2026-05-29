import { API_CONFIG } from '@/config/api-config';
import type { PaginatedResponse, Tag, TagFormData } from '@/types';

import { apiClient } from './api-client';

class TagsService {
  async getAll(): Promise<PaginatedResponse<Tag>> {
    return apiClient.get<PaginatedResponse<Tag>>(API_CONFIG.ENDPOINTS.TAGS);
  }

  async create(data: TagFormData): Promise<Tag> {
    return apiClient.post<Tag>(API_CONFIG.ENDPOINTS.TAGS, data);
  }

  async update(id: number, data: Partial<TagFormData>): Promise<Tag> {
    return apiClient.patch<Tag>(`${API_CONFIG.ENDPOINTS.TAGS}${id}/`, data);
  }

  async delete(id: number): Promise<void> {
    await apiClient.delete(`${API_CONFIG.ENDPOINTS.TAGS}${id}/`);
  }
}

export const tagsService = new TagsService();
