import { useQuery } from '@tanstack/react-query';

import { vaultConfigService } from '@/services/security-vault-service';
import type { VaultStatus } from '@/types';

interface UseVaultStatusResult {
  status: VaultStatus | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useVaultStatus(): UseVaultStatusResult {
  const {
    data: status = null,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['vault-status'],
    queryFn: async () => {
      try {
        return await vaultConfigService.getStatus();
      } catch {
        return null;
      }
    },
  });

  const refresh = async () => {
    await refetch();
  };

  return { status, isLoading, refresh };
}
