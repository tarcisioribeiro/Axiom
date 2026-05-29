import { API_CONFIG } from '@/config/constants';
import type { LiteraryTypeGoal, LiteraryTypeGoalFormData } from '@/types';

import { BaseService } from './base-service';

class LiteraryTypeGoalsService extends BaseService<
  LiteraryTypeGoal,
  LiteraryTypeGoalFormData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.LITERARY_TYPE_GOALS);
  }
}

export const literaryTypeGoalsService = new LiteraryTypeGoalsService();
