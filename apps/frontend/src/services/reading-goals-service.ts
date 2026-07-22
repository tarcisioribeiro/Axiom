import { API_CONFIG } from '@/config/constants';
import type { ReadingGoal, ReadingGoalFormData } from '@/types';

import { BaseService } from './base-service';

class ReadingGoalsService extends BaseService<ReadingGoal, ReadingGoalFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.READING_GOALS);
  }
}

export const readingGoalsService = new ReadingGoalsService();
