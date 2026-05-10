import { LogOut, Menu, Search, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-header border-b border-border/60 bg-card/80 px-md py-md backdrop-blur-md md:px-lg">
      <div className="flex items-center justify-between gap-sm">
        {/* Hamburger — mobile only */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="shrink-0 md:hidden"
          aria-label={t('layout.openMenu')}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>

        {/* Breadcrumb */}
        <div className="min-w-0 flex-1 md:flex-none">
          <Breadcrumb />
        </div>

        {/* Right-side actions */}
        <div className="flex shrink-0 items-center gap-xs md:gap-md">
          {/* Command palette trigger — styled as a search bar on desktop */}
          <button
            onClick={openCommandPalette}
            className="hover-lift hidden items-center gap-sm rounded-md border border-border/60 bg-background/60 px-3 py-sm text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground md:flex"
            aria-label={t('layout.openCommandPalette')}
          >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden lg:inline">{t('layout.search')}</span>
            <kbd className="ml-xs hidden items-center gap-0.5 rounded bg-muted px-sm py-0.5 font-mono text-xs text-muted-foreground lg:flex">
              <span className="text-sm">⌘</span>K
            </kbd>
          </button>

          {/* Command palette icon — mobile only */}
          <Button
            variant="ghost"
            size="icon"
            onClick={openCommandPalette}
            className="md:hidden"
            aria-label={t('layout.openCommandPalette')}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>

          <ThemeToggle className="hover-lift" />

          {/* Language selector — hidden on small mobile to prevent overflow */}
          <div className="hidden sm:block">
            <LanguageSelector />
          </div>

          <NotificationBell />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => void navigate('/settings/profile')}
            className="hover-lift"
            aria-label={t('layout.userSettings')}
            title={t('layout.userSettings')}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="hover-lift"
            aria-label={t('layout.logout')}
            title={t('layout.logout')}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
};
