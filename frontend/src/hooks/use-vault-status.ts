import { useState, useEffect, useCallback } from 'react';

import { vaultConfigService } from '@/services/security-vault-service';
import type { VaultStatus } from '@/types';

interface UseVaultStatusResult {
  status: VaultStatus | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useVaultStatus(): UseVaultStatusResult {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await vaultConfigService.getStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, isLoading, refresh };
}
