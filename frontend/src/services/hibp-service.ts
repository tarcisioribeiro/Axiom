import { API_CONFIG } from '@/config/constants';

import { apiClient } from './api-client';

async function sha1(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export interface HibpCheckResult {
  breached: boolean;
  count: number;
}

class HibpService {
  async checkPassword(password: string): Promise<HibpCheckResult> {
    const hash = await sha1(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await apiClient.post<{ suffixes: string }>(
      API_CONFIG.ENDPOINTS.HIBP_CHECK,
      { prefix }
    );

    const lines = response.suffixes.split('\n');
    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (hashSuffix && hashSuffix.toUpperCase() === suffix) {
        return { breached: true, count: parseInt(countStr ?? '1', 10) };
      }
    }
    return { breached: false, count: 0 };
  }
}

export const hibpService = new HibpService();
