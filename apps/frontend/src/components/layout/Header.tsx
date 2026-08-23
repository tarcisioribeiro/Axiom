import {
  Bars3Icon as Menu,
  MagnifyingGlassIcon as Search,
} from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

import { LanguageSelector } from '@/components/common/LanguageSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { VaultExpiryBadge } from '@/components/security/VaultGuard';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/hooks/use-sidebar';
import { useVaultStatus } from '@/hooks/use-vault-status';
import { useCommandPaletteStore } from '@/stores/command-palette-store';

export const Header = () => {
  const { toggle: toggleSidebar } = useSidebar();
  const { t } = useTranslation();
  const openCommandPalette = useCommandPaletteStore((s) => s.open);
  const { status: vaultStatus, refresh: refreshVaultStatus } = useVaultStatus();

  return (
    <header className="z-header border-border/60 bg-card/80 px-md py-md md:px-lg sticky top-0 border-b backdrop-blur-md">
      <div className="gap-sm flex items-center justify-between">
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
        <div className="gap-xs flex shrink-0 items-center">
          {/* Command palette trigger — styled as a search bar on desktop */}
          <button
            onClick={openCommandPalette}
            className="gap-sm border-border/60 bg-background/60 py-sm text-muted-foreground hover:border-border hover:text-foreground hidden items-center rounded-md border px-3 text-sm transition-colors md:flex"
            aria-label={t('layout.openCommandPalette')}
          >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden lg:inline">{t('layout.search')}</span>
            <kbd className="ml-xs bg-muted px-sm text-muted-foreground hidden items-center gap-0.5 rounded py-0.5 font-mono text-xs lg:flex">
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

          {vaultStatus?.is_unlocked && vaultStatus.expires_at && (
            <VaultExpiryBadge
              expiresAt={vaultStatus.expires_at}
              onRenew={refreshVaultStatus}
            />
          )}

          <ThemeToggle />

          {/* Language selector — hidden on small mobile to prevent overflow */}
          <div className="hidden sm:block">
            <LanguageSelector />
          </div>

          <NotificationBell />
        </div>
      </div>
    </header>
  );
};
