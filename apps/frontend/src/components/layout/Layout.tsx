import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useLocation, useOutlet } from 'react-router';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { PageTour } from '@/components/common/PageTour';

import { CommandPalette } from './CommandPalette';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StudyTimer } from './StudyTimer';

// Intelecto module routes (see nav-config.ts `library` module — titled
// "Intelecto" in the UI): reading timer on the reading pages, study timer on
// the course/skill pages.
const READING_TIMER_PATTERN = /^\/library\/(books|authors|publishers)(\/|$)/;
const STUDY_TIMER_PATTERN = /^\/library\/(courses|skills|knowledge-graph)(\/|$)/;

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

      {/* Tour guiado da página atual */}
      <PageTour />

      {/* Floating reading/study timers — Intelecto module only */}
      {READING_TIMER_PATTERN.test(pathname) && (
        <StudyTimer key="reading" mode="reading" />
      )}
      {STUDY_TIMER_PATTERN.test(pathname) && <StudyTimer key="course" mode="course" />}

      {/* Floating AI chat widget — Controle Financeiro module only */}
    </div>
  );
};
