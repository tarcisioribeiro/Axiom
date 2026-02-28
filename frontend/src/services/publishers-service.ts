import { API_CONFIG } from '@/config/constants';
import type { Publisher, PublisherFormData } from '@/types';

import { BaseService } from './base-service';

class PublishersService extends BaseService<Publisher, PublisherFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.PUBLISHERS);
  }
}

export const publishersService = new PublishersService();
