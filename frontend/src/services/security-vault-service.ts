import { API_CONFIG } from '@/config/constants';
import type {
  VaultChangePasswordData,
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

  async exportVaultZip(): Promise<void> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SECURITY_VAULT_EXPORT}`,
      { credentials: 'include' }
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      throw new Error(data.detail ?? 'Erro ao exportar cofre.');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.setAttribute('download', `axiom_vault_${timestamp}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
}

export const vaultConfigService = new VaultConfigService();
