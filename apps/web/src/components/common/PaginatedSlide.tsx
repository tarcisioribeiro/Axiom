import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Children,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { slideVariants } from '@/lib/animations';
import { cn } from '@/lib/utils';

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
  /** Lista de uma coluna só que cresce por inclusão (ex.: aulas de um módulo,
   * criadas uma a uma na mesma tela/modal): reserva desde o início a altura
   * da página cheia, centraliza os itens nela enquanto não completa, anima a
   * entrada de cada item e pagina sozinha ao estourar o tamanho da página.
   * Não usar em grade de múltiplas colunas (a altura reservada pressupõe uma
   * linha por item). */
  growOnAdd?: boolean;
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
  growOnAdd,
  ...rest
}: PaginatedSlideProps<T>) {
  const [pageIndex, setPageIndex] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  // Clampa caso a lista encolha (ex.: após excluir) e a página atual suma.
  const index = Math.min(pageIndex, totalPages - 1);

  // Pula para a página nova assim que um item incluído estoura a atual.
  const prevLength = useRef(items.length);
  useEffect(() => {
    if (growOnAdd && items.length > prevLength.current) {
      setPageIndex(Math.max(1, Math.ceil(items.length / pageSize)) - 1);
    }
    prevLength.current = items.length;
  }, [items.length, growOnAdd, pageSize]);

  const pageItems = items.slice(index * pageSize, (index + 1) * pageSize);
  return (
    <PageSlide
      page={index + 1}
      totalPages={totalPages}
      onPageChange={(next) => setPageIndex(next - 1)}
      resetKey={items.length === 0}
      pageSize={pageSize}
      pageItemCount={pageItems.length}
      growOnAdd={growOnAdd}
      {...rest}
    >
      {children(pageItems)}
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
  /** Tamanho da página e nº de itens na página atual, usados só com
   * `growOnAdd` para projetar a altura da página cheia. */
  pageSize?: number;
  pageItemCount?: number;
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
  pageSize,
  pageItemCount,
  growOnAdd,
  className,
  pinNav = true,
  centerList = true,
  children,
}: PageSlideProps) {
  // Direção derivada da página anterior (padrão "estado da renderização anterior").
  const [last, setLast] = useState({ page, direction: 1 });
  if (last.page !== page) setLast({ page, direction: page > last.page ? 1 : -1 });

  // Mantém a altura da lista na maior já vista (página cheia), para os botões
  // de navegação não pularem durante a transição nem na última página. Com
  // `growOnAdd`, projeta a altura da página cheia a partir do item atual, para
  // já reservar o espaço com só 1 item na tela.
  const meta = useRef({ growOnAdd, pageSize, pageItemCount });
  useEffect(() => {
    meta.current = { growOnAdd, pageSize, pageItemCount };
  });
  const listRef = useRef<HTMLDivElement>(null);
  // Mede o conteúdo (contentRef), nunca o próprio `list` — ele recebe a
  // min-height calculada, e observá-lo criaria um loop de realimentação
  // (a min-height infla a altura observada, que infla a próxima min-height).
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    const content = contentRef.current;
    if (!list || !content) return;
    list.style.minHeight = '';
    const observer = new ResizeObserver(() => {
      const { growOnAdd, pageSize, pageItemCount } = meta.current;
      const projected =
        growOnAdd && pageSize && pageItemCount
          ? (content.offsetHeight / pageItemCount) * pageSize
          : 0;
      const current = parseFloat(list.style.minHeight) || 0;
      const next = Math.max(current, content.offsetHeight, projected);
      if (next > current) list.style.minHeight = `${next}px`;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [resetKey]);

  return (
    <div className={cn('gap-md flex flex-1 flex-col', pinNav && 'page-fill')}>
      {/* Ocupa o espaço livre acima da navegação; a lista (listRef) mede só o
          próprio conteúdo, para a altura travada não crescer com a janela. */}
      <div
        className={cn(
          'flex flex-1 flex-col',
          centerList && (totalPages > 1 || growOnAdd) && 'justify-center'
        )}
      >
        <div ref={listRef} className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={last.direction}>
            <motion.div
              ref={contentRef}
              key={page}
              custom={last.direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className={className}
            >
              {growOnAdd ? (
                <AnimatePresence mode="popLayout" initial={false}>
                  {Children.toArray(children).map((child) => (
                    <motion.div
                      key={(child as ReactElement).key}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {child}
                    </motion.div>
                  ))}
                </AnimatePresence>
              ) : (
                children
              )}
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
function PaginationNav({
  page,
  totalPages,
  onPageChange,
  className,
}: PaginationNavProps) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;
  return (
    <div className={cn('gap-sm flex items-center justify-center', className)}>
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
