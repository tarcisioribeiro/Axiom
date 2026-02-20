import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type { DailyReflection, DailyReflectionFormData } from '@/types';

class DailyReflectionsService extends BaseService<DailyReflection, DailyReflectionFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.REFLECTIONS);
  }
}

export const dailyReflectionsService = new DailyReflectionsService();
