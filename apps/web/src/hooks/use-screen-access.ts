import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router';

import { canAccess, canAccessModule, screenForPath } from '@/lib/screen-access';
import { authService } from '@/services/auth-service';
import { useAuthStore } from '@/stores/auth-store';

/** Acesso por tela do usuário logado. Staff e superuser têm acesso total. */
export function useScreenAccess() {
  const user = useAuthStore((s) => s.user);
  const fullAccess = !!user?.is_staff || !!user?.is_superuser;
  const { data, isPending } = useQuery({
    // username na chave: outro login na mesma aba não reaproveita o cache
    queryKey: ['me', 'screens', user?.username],
    queryFn: () => authService.getScreenGrants(),
    enabled: !!user && !fullAccess,
    staleTime: 60_000,
  });
  const grants = fullAccess ? null : (data ?? {});

  return {
    ready: fullAccess || !isPending,
    can: (screen: string | undefined, action = 'view') =>
      canAccess(grants, screen, action),
    canModule: (module: string) => canAccessModule(grants, module),
  };
}

/** Acesso às ações da tela da rota atual. */
export function useCurrentScreen() {
  const { pathname } = useLocation();
  const { can } = useScreenAccess();
  const screen = screenForPath(pathname);
  return { screen, can: (action: string) => can(screen, action) };
}
