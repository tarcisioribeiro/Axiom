import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type { Transfer, TransferFormData } from '@/types';

class TransfersService extends BaseService<Transfer, TransferFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.TRANSFERS);
  }
}

export const transfersService = new TransfersService();
