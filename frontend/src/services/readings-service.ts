import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type { Reading, ReadingFormData } from '@/types';

class ReadingsService extends BaseService<Reading, ReadingFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.READINGS);
  }
}

export const readingsService = new ReadingsService();
