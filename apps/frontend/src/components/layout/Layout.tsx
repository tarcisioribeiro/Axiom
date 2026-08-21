import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useLocation, useOutlet } from 'react-router';

import { AgentChatWidget } from '@/components/agents/AgentChatWidget';
import { AnimatedPage } from '@/components/common/AnimatedPage';

import { CommandPalette } from './CommandPalette';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StudyTimer } from './StudyTimer';

// Controle Financeiro module routes (see nav-config.ts `finance` module +
// standalone finance pages linked from the dashboard, not all of which are
// in the sidebar).
const FINANCE_MODULE_PATTERN =
  /^\/(dashboard|accounts|transactions|recurring|fixed-expenses|fixed-revenues|finance|categorization-rules|automation-rules|tags|credit-cards|credit-card-bills|credit-card-expenses|transfers|loans|bills|members|budgets|webhooks|bank-reconciliation|vaults|financial-goals)(\/|$)/;

// Intelecto module routes (see nav-config.ts `library` module — titled
// "Intelecto" in the UI).
const INTELLECT_MODULE_PATTERN = /^\/library(\/|$)/;

export const Layout = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const outlet = useOutlet();

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
          <AnimatePresence mode="wait" initial={false}>
            <AnimatedPage key={pathname}>{outlet}</AnimatedPage>
          </AnimatePresence>
        </main>
      </div>

      {/* Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPalette />

      {/* Floating study timer — Intelecto module only */}
      {INTELLECT_MODULE_PATTERN.test(pathname) && <StudyTimer />}

      {/* Floating AI chat widget — Controle Financeiro module only */}
      {FINANCE_MODULE_PATTERN.test(pathname) && <AgentChatWidget />}
    </div>
  );
};
