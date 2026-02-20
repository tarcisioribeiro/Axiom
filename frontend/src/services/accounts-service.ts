import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type { Account, AccountFormData } from '@/types';

class AccountsService extends BaseService<Account, AccountFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.ACCOUNTS);
  }
}

export const accountsService = new AccountsService();
