import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAgentWidgetStore } from '@/stores/agent-widget-store';

interface PaginatedSlideProps<T> {
  items: T[];
  pageSize: number;
  /** Classes do container de cada página (ex.: grid, space-y). */
  className?: string;
  /** Fixa a navegação no rodapé da área da página (padrão). Use `false` em
   * listas que são só uma seção dentro de outra tela. */
  pinNav?: boolean;
  /** Centraliza a lista na vertical no espaço acima da navegação. */
  centerList?: boolean;
  children: (pageItems: T[]) => ReactNode;
}

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
};

/**
 * Lista paginada no cliente com navegação ‹ › centralizada e transição de
 * deslize na direção da navegação. Para voltar à primeira página (ex.: troca
 * de filtro), remonte com `key`.
 *
 * Com `pinNav`, a classe `page-fill` faz os ancestrais até o <main>
 * ocuparem a altura restante (ver index.css), e a lista cresce empurrando a navegação:
 * fica na mesma altura em todas as telas.
 */
export function PaginatedSlide<T>({
  items,
  pageSize,
  className,
  pinNav = true,
  centerList = false,
  children,
}: PaginatedSlideProps<T>) {
  const [page, setPage] = useState({ index: 0, direction: 1 });

  // Mantém a altura da lista na maior já vista (página cheia), para os botões
  // de navegação não pularem durante a transição nem na última página.
  const listRef = useRef<HTMLDivElement>(null);
  const isEmpty = items.length === 0;
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.style.minHeight = '';
    const observer = new ResizeObserver(() => {
      const current = parseFloat(list.style.minHeight) || 0;
      if (list.offsetHeight > current) list.style.minHeight = `${list.offsetHeight}px`;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [isEmpty]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  // Clampa caso a lista encolha (ex.: após excluir) e a página atual suma.
  const pageIndex = Math.min(page.index, totalPages - 1);
  const pageItems = items.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const goTo = (direction: 1 | -1) =>
    setPage({ index: pageIndex + direction, direction });

  return (
    <div className={cn('gap-md flex flex-1 flex-col', pinNav && 'page-fill')}>
      {/* Ocupa o espaço livre acima da navegação; a lista (listRef) mede só o
          próprio conteúdo, para a altura travada não crescer com a janela. */}
      <div className={cn('flex flex-1 flex-col', centerList && 'justify-center')}>
        <div ref={listRef} className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={page.direction}>
            <motion.div
              key={pageIndex}
              custom={page.direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className={className}
            >
              {children(pageItems)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <PaginationNav
        page={pageIndex + 1}
        totalPages={totalPages}
        onPageChange={(next) => goTo(next > pageIndex + 1 ? 1 : -1)}
      />
    </div>
  );
}

interface PaginationNavProps {
  /** Página atual, começando em 1. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Navegação ‹ Página X de Y › padrão do app. Usada pelo PaginatedSlide e por
 * listas paginadas no servidor (DataTable, logs). Some com uma página só.
 */
export function PaginationNav({
  page,
  totalPages,
  onPageChange,
  className,
}: PaginationNavProps) {
  const { t } = useTranslation();
  // O widget do agente fica no canto inferior e pode cobrir a navegação.
  const setAgentWidgetHidden = useAgentWidgetStore((s) => s.setHiddenByNav);
  useEffect(() => () => setAgentWidgetHidden(false), [setAgentWidgetHidden]);

  if (totalPages <= 1) return null;
  return (
    <div
      className={cn('gap-sm flex items-center justify-center', className)}
      onMouseEnter={() => setAgentWidgetHidden(true)}
      onMouseLeave={() => setAgentWidgetHidden(false)}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label={t('common.table.previousPage')}
        title={t('common.table.previousPage')}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <span
        className="text-muted-foreground min-w-32 text-center text-sm tabular-nums"
        aria-live="polite"
      >
        {t('common.table.pageOf', { page, totalPages })}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label={t('common.table.nextPage')}
        title={t('common.table.nextPage')}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
