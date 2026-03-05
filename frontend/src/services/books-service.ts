import { API_CONFIG } from '@/config/constants';
import type { Book, BookFormData, PaginatedResponse } from '@/types';

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

  async getReadingQueue(): Promise<Book[]> {
    const response = await apiClient.get<PaginatedResponse<Book>>(
      API_CONFIG.ENDPOINTS.READING_QUEUE
    );
    return response.results;
  }

  async reorderQueue(items: { id: number; priority: number }[]): Promise<void> {
    await apiClient.patch<{ detail: string }>(
      API_CONFIG.ENDPOINTS.BOOK_REORDER,
      items
    );
  }
}

export const booksService = new BooksService();
