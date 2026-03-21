import { LogOut, Menu } from 'lucide-react';
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
    <header className="border-b bg-card px-md py-md lg:px-lg">
      <div className="flex items-center justify-between">
        {/* Botão Hamburger (apenas mobile) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="mr-sm lg:hidden"
          aria-label={t('layout.openMenu')}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>

        {/* Breadcrumb Navigation */}
        <div className="flex-1 lg:flex-none">
          <Breadcrumb />
        </div>

        <div className="flex items-center gap-md">
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
