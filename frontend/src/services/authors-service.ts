import { API_CONFIG } from '@/config/constants';
import type { Author, AuthorFormData } from '@/types';

import { BaseService } from './base-service';

class AuthorsService extends BaseService<Author, AuthorFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.AUTHORS);
  }
}

export const authorsService = new AuthorsService();
