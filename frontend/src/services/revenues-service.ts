import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type { Revenue, RevenueFormData } from '@/types';

class RevenuesService extends BaseService<Revenue, RevenueFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.REVENUES);
  }
}

export const revenuesService = new RevenuesService();
