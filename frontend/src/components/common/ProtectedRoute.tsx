import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

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

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Superusuários só acessam o painel admin
  if (isAdmin) return <Navigate to="/admin" replace />;

  if (requirePermission) {
    const { appName, action } = requirePermission;
    if (!hasPermission(appName, action)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};
