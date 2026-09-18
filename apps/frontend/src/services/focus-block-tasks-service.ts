import { API_CONFIG } from '@/config/constants';
import type { FocusBlockTask, FocusBlockTaskFormData } from '@/types';

import { BaseService } from './base-service';

class FocusBlockTasksService extends BaseService<
  FocusBlockTask,
  FocusBlockTaskFormData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.FOCUS_BLOCK_TASKS);
  }
}

export const focusBlockTasksService = new FocusBlockTasksService();
