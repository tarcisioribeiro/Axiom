import { API_CONFIG } from '@/config/constants';
import type { Account, AccountFormData } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

export interface ProjectedBalance {
  account_id: string;
  date: string;
  current_balance: string;
  projected_balance: string;
}

class AccountsService extends BaseService<Account, AccountFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.ACCOUNTS);
  }

  async getProjectedBalance(
    accountId: number,
    date: string
  ): Promise<ProjectedBalance> {
    return apiClient.get<ProjectedBalance>(
      `${API_CONFIG.ENDPOINTS.ACCOUNT_PROJECTED_BALANCE(accountId)}?date=${date}`
    );
  }
}

export const accountsService = new AccountsService();
