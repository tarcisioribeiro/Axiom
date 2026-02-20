import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type { RoutineTask, RoutineTaskFormData } from '@/types';

class RoutineTasksService extends BaseService<RoutineTask, RoutineTaskFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.ROUTINE_TASKS);
  }
}

export const routineTasksService = new RoutineTasksService();
