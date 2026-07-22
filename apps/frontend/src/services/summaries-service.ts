import { API_CONFIG } from '@/config/constants';
import type { Summary, SummaryFormData } from '@/types';

import { BaseService } from './base-service';

class SummariesService extends BaseService<Summary, SummaryFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.SUMMARIES);
  }
}

export const summariesService = new SummariesService();
