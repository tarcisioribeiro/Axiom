import { API_CONFIG } from '@/config/constants';
import type { FocusBlock, FocusBlockFormData } from '@/types';

import { BaseService } from './base-service';

class FocusBlocksService extends BaseService<FocusBlock, FocusBlockFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.FOCUS_BLOCKS);
  }
}

export const focusBlocksService = new FocusBlocksService();
