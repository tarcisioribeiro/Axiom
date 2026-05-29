import { API_CONFIG } from '@/config/constants';
import type { BookHighlight, BookHighlightFormData } from '@/types';

import { BaseService } from './base-service';

class BookHighlightsService extends BaseService<BookHighlight, BookHighlightFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.BOOK_HIGHLIGHTS);
  }

  async getByBook(bookId: number): Promise<BookHighlight[]> {
    return this.getAll({ book: bookId });
  }

  async exportAs(
    format: 'markdown' | 'json' | 'csv' = 'markdown',
    bookId?: number
  ): Promise<Blob> {
    const params = new URLSearchParams({ format });
    if (bookId) params.set('book', String(bookId));
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BOOK_HIGHLIGHTS_EXPORT}?${params}`;
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error('Falha ao exportar destaques');
    return response.blob();
  }

  async exportMarkdown(bookId?: number): Promise<Blob> {
    return this.exportAs('markdown', bookId);
  }
}

export const bookHighlightsService = new BookHighlightsService();
