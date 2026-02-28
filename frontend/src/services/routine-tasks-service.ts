import { API_CONFIG } from '@/config/constants';
import type { RoutineTask, RoutineTaskFormData } from '@/types';

import { BaseService } from './base-service';

class RoutineTasksService extends BaseService<RoutineTask, RoutineTaskFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.ROUTINE_TASKS);
  }
}

export const routineTasksService = new RoutineTasksService();
