import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type { Book, BookFormData } from '@/types';

class BooksService extends BaseService<Book, BookFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.BOOKS);
  }
}

export const booksService = new BooksService();
