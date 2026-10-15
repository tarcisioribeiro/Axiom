import { Loader2 } from 'lucide-react';
import { Navigate, useLocation } from 'react-router';

import { useScreenAccess } from '@/hooks/use-screen-access';
import { screenForPath } from '@/lib/screen-access';
import { useAuthStore } from '@/stores/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requirePermission?: {
    appName: string;
    action: string;
  };
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requirePermission,
}) => {
  const { isAuthenticated, isInitializing, isAdmin, hasPermission } = useAuthStore();
  const { ready, can } = useScreenAccess();
  const { pathname } = useLocation();

  if (isInitializing || (isAuthenticated && !isAdmin && !ready)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="text-primary h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Superusuários só acessam o painel admin
  if (isAdmin) return <Navigate to="/admin" replace />;

  // Tela sem "Ver" no controle de acesso por tela
  if (!can(screenForPath(pathname))) return <Navigate to="/unauthorized" replace />;

  if (requirePermission) {
    const { appName, action } = requirePermission;
    if (!hasPermission(appName, action)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};
