import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type { Author, AuthorFormData } from '@/types';

class AuthorsService extends BaseService<Author, AuthorFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.AUTHORS);
  }
}

export const authorsService = new AuthorsService();
