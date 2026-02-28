import { API_CONFIG } from '@/config/constants';
import type { Account, AccountFormData } from '@/types';

import { BaseService } from './base-service';

class AccountsService extends BaseService<Account, AccountFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.ACCOUNTS);
  }
}

export const accountsService = new AccountsService();
