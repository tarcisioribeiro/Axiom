import { useAuthStore } from '@/stores/auth-store';
import { useSidebar } from '@/hooks/use-sidebar';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { LogOut, Moon, Sun, Menu } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

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
          <Menu className="w-5 h-5" aria-hidden="true" />
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
            className="relative overflow-hidden hover:bg-secondary transition-all hover-lift"
          >
            <div className="relative">
              {isDark ? (
                <Sun className="w-5 h-5 text-warning transition-transform rotate-0 hover:rotate-180 duration-500" aria-hidden="true" />
              ) : (
                <Moon className="w-5 h-5 text-primary transition-transform rotate-0 hover:rotate-[-15deg] duration-300" aria-hidden="true" />
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
