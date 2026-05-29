import { API_CONFIG } from '@/config/constants';
import type {
  CredentialShareToken,
  CreateShareTokenData,
  SharedCredential,
} from '@/types';

import { apiClient } from './api-client';

class CredentialShareService {
  getTokens(passwordId: number): Promise<CredentialShareToken[]> {
    const url = API_CONFIG.ENDPOINTS.PASSWORD_SHARE_TOKENS.replace(
      ':id',
      String(passwordId)
    );
    return apiClient.get<CredentialShareToken[]>(url);
  }

  createToken(
    passwordId: number,
    data: CreateShareTokenData
  ): Promise<CredentialShareToken> {
    const url = API_CONFIG.ENDPOINTS.PASSWORD_SHARE_TOKENS.replace(
      ':id',
      String(passwordId)
    );
    return apiClient.post<CredentialShareToken>(url, data);
  }

  revokeToken(tokenId: number): Promise<void> {
    const url = API_CONFIG.ENDPOINTS.SHARE_TOKEN_REVOKE.replace(':id', String(tokenId));
    return apiClient.delete<void>(url);
  }

  redeemToken(token: string, key: string): Promise<SharedCredential> {
    const url = API_CONFIG.ENDPOINTS.SHARE_TOKEN_REDEEM.replace(':token', token);
    return apiClient.post<SharedCredential>(url, { key });
  }
}

export const credentialShareService = new CredentialShareService();
