import { LogOut, Menu, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LanguageSelector } from '@/components/common/LanguageSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/hooks/use-sidebar';
import { useAuthStore } from '@/stores/auth-store';

export const Header = () => {
  const { logout } = useAuthStore();
  const { toggle: toggleSidebar } = useSidebar();
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 border-b bg-card px-md py-md md:px-lg">
      <div className="flex items-center justify-between">
        {/* Botão Hamburger (apenas mobile) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="mr-sm md:hidden"
          aria-label={t('layout.openMenu')}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>

        {/* Breadcrumb Navigation */}
        <div className="flex-1 md:flex-none">
          <Breadcrumb />
        </div>

        <div className="flex items-center gap-md">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
              )
            }
            className="hover-lift"
            aria-label="Abrir menu de comandos"
            title="Menu de Comandos (Ctrl+K)"
          >
            <Search className="h-4 w-4" />
          </Button>

          <ThemeToggle className="hover-lift" />

          <LanguageSelector />

          <NotificationBell />

          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="hover-lift"
            aria-label={t('layout.logout')}
            title={t('layout.logout')}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
