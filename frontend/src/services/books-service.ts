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
    await apiClient.patch<{ detail: string }>(API_CONFIG.ENDPOINTS.BOOK_REORDER, items);
  }

  async uploadBookFile(
    id: number,
    file: File
  ): Promise<{ detail: string; name: string }> {
    const formData = new FormData();
    formData.append('book_file', file);
    return apiClient.patch<{ detail: string; name: string }>(
      `${API_CONFIG.ENDPOINTS.BOOK_FILE}${id}/file/`,
      formData
    );
  }

  async getBookFileUrl(id: number): Promise<{ url: string; name: string }> {
    return apiClient.get<{ url: string; name: string }>(
      `${API_CONFIG.ENDPOINTS.BOOK_FILE}${id}/file/`
    );
  }

  async deleteBookFile(id: number): Promise<void> {
    await apiClient.delete(`${API_CONFIG.ENDPOINTS.BOOK_FILE}${id}/file/`);
  }

  async markAsRead(
    id: number,
    startDate: string,
    endDate: string
  ): Promise<{ sessions_created: number }> {
    const response = await apiClient.post<{ sessions_created: number }>(
      `${API_CONFIG.ENDPOINTS.BOOKS}${id}/mark-as-read/`,
      { start_date: startDate, end_date: endDate }
    );
    return response;
  }
}

export const booksService = new BooksService();
