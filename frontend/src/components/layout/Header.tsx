import { LogOut, Menu, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LanguageSelector } from '@/components/common/LanguageSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/hooks/use-sidebar';
import { useAuthStore } from '@/stores/auth-store';
import { useCommandPaletteStore } from '@/stores/command-palette-store';

export const Header = () => {
  const { logout } = useAuthStore();
  const { toggle: toggleSidebar } = useSidebar();
  const { t } = useTranslation();
  const openCommandPalette = useCommandPaletteStore((s) => s.open);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 px-md py-md backdrop-blur-md md:px-lg">
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
            onClick={openCommandPalette}
            className="hover-lift"
            aria-label={t('layout.openCommandPalette')}
            title={t('layout.openCommandPalette')}
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
