import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';

import { CommandPalette } from './CommandPalette';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export const Layout = () => {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Skip link para acessibilidade - permite pular navegacao */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-md focus:top-md focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-md focus:py-sm focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {t('layout.skipToContent')}
      </a>

      {/* Sidebar: fixa em desktop, overlay em mobile */}
      <Sidebar />

      {/* Main content: ocupa espaço restante */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main id="main-content" className="flex-1 p-0" role="main">
          <Outlet />
        </main>
      </div>

      {/* Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPalette />
    </div>
  );
};
