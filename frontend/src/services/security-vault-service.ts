import { API_CONFIG } from '@/config/constants';
import type {
  VaultChangePasswordData,
  VaultMigrateData,
  VaultMigrateResult,
  VaultSetupData,
  VaultStatus,
  VaultUnlockData,
} from '@/types';

import { apiClient } from './api-client';

class VaultConfigService {
  async getStatus(): Promise<VaultStatus> {
    return apiClient.get<VaultStatus>(API_CONFIG.ENDPOINTS.SECURITY_VAULT_STATUS);
  }

  async setup(data: VaultSetupData): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(
      API_CONFIG.ENDPOINTS.SECURITY_VAULT_SETUP,
      data
    );
  }

  async unlock(
    data: VaultUnlockData
  ): Promise<{ message: string; expires_in: number }> {
    return apiClient.post<{ message: string; expires_in: number }>(
      API_CONFIG.ENDPOINTS.SECURITY_VAULT_UNLOCK,
      data
    );
  }

  async lock(): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(
      API_CONFIG.ENDPOINTS.SECURITY_VAULT_LOCK
    );
  }

  async changePassword(data: VaultChangePasswordData): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(
      API_CONFIG.ENDPOINTS.SECURITY_VAULT_CHANGE_PASSWORD,
      data
    );
  }

  async migrateFromBackup(data: VaultMigrateData): Promise<VaultMigrateResult> {
    return apiClient.post<VaultMigrateResult>(
      API_CONFIG.ENDPOINTS.SECURITY_VAULT_MIGRATE,
      data
    );
  }
}

export const vaultConfigService = new VaultConfigService();
