import { API_CONFIG } from '@/config/constants';
import type { Author, AuthorFormData } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class AuthorsService extends BaseService<Author, AuthorFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.AUTHORS);
  }

  async uploadPhoto(id: number, file: File): Promise<Author> {
    const formData = new FormData();
    formData.append('photo', file);
    return apiClient.patch<Author>(`${this.endpoint}${id}/`, formData);
  }
}

export const authorsService = new AuthorsService();
