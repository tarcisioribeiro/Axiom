import { API_CONFIG } from '@/config/constants';
import type { Book, BookFormData } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class BooksService extends BaseService<Book, BookFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.BOOKS);
  }

  async uploadCover(id: number, file: File): Promise<Book> {
    const formData = new FormData();
    formData.append('cover', file);
    return apiClient.patch<Book>(`${this.endpoint}${id}/`, formData);
  }
}

export const booksService = new BooksService();
