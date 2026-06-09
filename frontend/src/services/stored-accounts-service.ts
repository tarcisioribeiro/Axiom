import { API_CONFIG } from '@/config/constants';
import type {
  StoredBankAccount,
  StoredBankAccountFormData,
  StoredBankAccountReveal,
} from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class StoredAccountsService extends BaseService<
  StoredBankAccount,
  StoredBankAccountFormData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.STORED_ACCOUNTS);
  }

  async reveal(id: number): Promise<StoredBankAccountReveal> {
    return apiClient.get<StoredBankAccountReveal>(`${this.endpoint}${id}/reveal/`);
  }

  async copy(id: number): Promise<StoredBankAccountReveal> {
    return apiClient.get<StoredBankAccountReveal>(`${this.endpoint}${id}/copy/`);
  }

  async toggleFavorite(id: number): Promise<StoredBankAccount> {
    return apiClient.patch<StoredBankAccount>(`${this.endpoint}${id}/favorite/`, {});
  }
}

export const storedAccountsService = new StoredAccountsService();
