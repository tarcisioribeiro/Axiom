import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { slideVariants } from '@/lib/animations';
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
  /** Centraliza a lista na vertical no espaço acima da navegação, só com mais
   * de uma página. Padrão `true` — use `false` para manter a lista alinhada
   * ao topo. */
  centerList?: boolean;
  children: (pageItems: T[]) => ReactNode;
}

/** Tamanhos padrão: grades de cards (divisível por 2, 3 e 4 colunas) e listas. */
export const GRID_PAGE_SIZE = 12;
export const LIST_PAGE_SIZE = 5;
/** Itens de texto longo (resumos, destaques, anotações): 3 por página (§2.5). */
export const DETAIL_TEXT_PAGE_SIZE = 3;

/**
 * Lista paginada no cliente com navegação ‹ › centralizada e transição de
 * deslize na direção da navegação. Para voltar à primeira página (ex.: troca
 * de filtro), remonte com `key`.
 */
export function PaginatedSlide<T>({
  items,
  pageSize,
  children,
  ...rest
}: PaginatedSlideProps<T>) {
  const [pageIndex, setPageIndex] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  // Clampa caso a lista encolha (ex.: após excluir) e a página atual suma.
  const index = Math.min(pageIndex, totalPages - 1);
  return (
    <PageSlide
      page={index + 1}
      totalPages={totalPages}
      onPageChange={(next) => setPageIndex(next - 1)}
      resetKey={items.length === 0}
      {...rest}
    >
      {children(items.slice(index * pageSize, (index + 1) * pageSize))}
    </PageSlide>
  );
}

interface PageSlideProps extends Omit<
  PaginatedSlideProps<never>,
  'items' | 'pageSize' | 'children'
> {
  /** Página atual, começando em 1. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Muda quando a altura travada da lista deve ser recalculada. */
  resetKey?: unknown;
  children: ReactNode;
}

/**
 * Versão controlada do PaginatedSlide, para listas paginadas no servidor
 * (DataTable, logs): mesma posição da navegação e mesma transição.
 *
 * Com `pinNav`, a classe `page-fill` faz os ancestrais até o <main>
 * ocuparem a altura restante (ver index.css), e a lista cresce empurrando a navegação:
 * fica na mesma altura em todas as telas.
 */
export function PageSlide({
  page,
  totalPages,
  onPageChange,
  resetKey,
  className,
  pinNav = true,
  centerList = true,
  children,
}: PageSlideProps) {
  // Direção derivada da página anterior (padrão "estado da renderização anterior").
  const [last, setLast] = useState({ page, direction: 1 });
  if (last.page !== page) setLast({ page, direction: page > last.page ? 1 : -1 });

  // Mantém a altura da lista na maior já vista (página cheia), para os botões
  // de navegação não pularem durante a transição nem na última página.
  const listRef = useRef<HTMLDivElement>(null);
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
  }, [resetKey]);

  return (
    <div className={cn('gap-md flex flex-1 flex-col', pinNav && 'page-fill')}>
      {/* Ocupa o espaço livre acima da navegação; a lista (listRef) mede só o
          próprio conteúdo, para a altura travada não crescer com a janela. */}
      <div
        className={cn(
          'flex flex-1 flex-col',
          centerList && totalPages > 1 && 'justify-center'
        )}
      >
        <div ref={listRef} className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={last.direction}>
            <motion.div
              key={page}
              custom={last.direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className={className}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <PaginationNav page={page} totalPages={totalPages} onPageChange={onPageChange} />
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
