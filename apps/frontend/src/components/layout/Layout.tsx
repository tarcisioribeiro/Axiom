import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { AgentChatWidget } from '@/components/agents/AgentChatWidget';

import { CommandPalette } from './CommandPalette';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StudyTimer } from './StudyTimer';

export const Layout = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-background flex min-h-screen">
      {/* Skip link para acessibilidade - permite pular navegacao */}
      <a
        href="#main-content"
        className="focus:left-md focus:top-md focus:bg-primary focus:px-md focus:py-sm focus:text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:rounded-lg focus:ring-2 focus:outline-none"
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

      {/* Floating study timer */}
      <StudyTimer />

      {/* Floating AI chat widget */}
      <AgentChatWidget />
    </div>
  );
};
