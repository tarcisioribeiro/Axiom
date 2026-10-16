import { useLocation } from 'react-router';

import { useScreenAccess } from '@/hooks/use-screen-access';
import { screenForPath } from '@/lib/screen-access';

interface CanProps {
  /** Ação exigida (view, add, change, delete ou específica da tela). */
  action: string;
  /** Tela; padrão: a da rota atual. */
  screen?: string;
  children: React.ReactNode;
}

/** Renderiza os filhos só se a ação estiver liberada (controle por tela). */
export function Can({ action, screen, children }: CanProps) {
  const { pathname } = useLocation();
  const { can } = useScreenAccess();
  return can(screen ?? screenForPath(pathname), action) ? <>{children}</> : null;
}
