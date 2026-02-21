import { LogOut, Moon, Sun, Menu } from 'lucide-react';

import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/hooks/use-sidebar';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth-store';

export const Header = () => {
  const { logout } = useAuthStore();
  const { toggle: toggleSidebar } = useSidebar();
  const { isDark, toggle: toggleTheme } = useTheme();

  return (
    <header className="border-b bg-card px-4 py-4 lg:px-6">
      <div className="flex items-center justify-between">
        {/* Botão Hamburger (apenas mobile) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="mr-2 lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>

        {/* Breadcrumb Navigation */}
        <div className="flex-1 lg:flex-none">
          <Breadcrumb />
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            className="hover-lift relative overflow-hidden transition-all hover:bg-secondary"
          >
            <div className="relative">
              {isDark ? (
                <Sun
                  className="h-5 w-5 rotate-0 text-warning transition-transform duration-500 hover:rotate-180"
                  aria-hidden="true"
                />
              ) : (
                <Moon
                  className="h-5 w-5 rotate-0 text-primary transition-transform duration-300 hover:rotate-[-15deg]"
                  aria-hidden="true"
                />
              )}
            </div>
          </Button>

          <NotificationBell />

          <Button
            variant="outline"
            onClick={logout}
            className="hover-lift flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
};
