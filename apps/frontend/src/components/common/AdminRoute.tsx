import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/auth-store';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAuthenticated, isInitializing, isAdmin } = useAuthStore();

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/unauthorized" replace />;

  return <>{children}</>;
};
