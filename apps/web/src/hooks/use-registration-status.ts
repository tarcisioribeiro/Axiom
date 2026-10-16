import { useQuery } from '@tanstack/react-query';

import { authService } from '@/services/auth-service';

/** O cadastro público só abre quando existe um staff ativo (backend). */
export const useRegistrationStatus = () =>
  useQuery({
    queryKey: ['registration-status'],
    queryFn: () => authService.getRegistrationStatus(),
  });
