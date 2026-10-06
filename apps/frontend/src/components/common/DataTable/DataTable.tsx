/**
 * DataTable Component
 *
 * Componente genérico e reutilizável para exibição de dados em tabela.
 *
 * Features:
 * - Tipagem genérica para qualquer tipo de dado
 * - Configuração flexível de colunas com render customizado
 * - Estados integrados (loading, empty)
 * - Coluna de ações customizável
 * - Alinhamento de texto por coluna
 * - Sempre paginado: no servidor (`pagination`) ou no cliente (`pageSize`),
 *   com a navegação e a transição padrão do app (PageSlide)
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '../EmptyState';
import { LoadingState } from '../LoadingState';
import { PageSlide } from '../PaginatedSlide';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (item: T) => React.ReactNode;
  className?: string;
}

export type DataTableDensity = 'comfortable' | 'compact';

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  density?: DataTableDensity;
  emptyState?: React.ComponentProps<typeof EmptyState>;
  /** Paginação no servidor (`data` já é a página atual). Sem ela, o
   * DataTable pagina `data` no cliente com `pageSize` itens por página. */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  pageSize?: number;
  /** Ver PaginatedSlide: fixa a navegação no rodapé da página (padrão). */
  pinNav?: boolean;
  /** Ver PaginatedSlide: centraliza a tabela na vertical acima da navegação. */
  centerList?: boolean;
  sorting?: {
    column: string | null;
    direction: 'asc' | 'desc' | null;
    onSort: (column: string) => void;
  };
  actions?: (item: T) => React.ReactNode;
  rowClassName?: (item: T) => string;
  /** Abre ao clicar na linha (ou Enter). Cliques em botões, links e campos não disparam. */
  onRowClick?: (item: T) => void;
  /** Row keys that are currently being deleted (fade + collapse animation) */
  deletingKeys?: Set<string | number>;
  /**
   * Custom mobile card renderer. When provided, replaces the default key-value
   * grid with a specialized layout for this resource type.
   */
  mobileCard?: (item: T) => React.ReactNode;
}

const DEFAULT_PAGE_SIZE = 10;

const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, label, [role="menuitem"], [role="checkbox"], [role="switch"]';

const getAlignClass = (align: Column<unknown>['align'] = 'left') => `text-${align}`;

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  density = 'comfortable',
  emptyState,
  pagination,
  pageSize = DEFAULT_PAGE_SIZE,
  pinNav,
  centerList,
  sorting,
  actions,
  rowClassName,
  onRowClick,
  deletingKeys,
  mobileCard,
}: DataTableProps<T>) {
  const cellPad = density === 'compact' ? 'px-md py-sm' : 'px-lg py-md';
  const { t } = useTranslation();
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const [clientPage, setClientPage] = useState(1);
  const clientTotalPages = Math.max(1, Math.ceil(data.length / pageSize));
  // Clampa caso a lista encolha (ex.: após excluir ou filtrar).
  const currentClientPage = Math.min(clientPage, clientTotalPages);
  const page = pagination?.page ?? currentClientPage;
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : clientTotalPages;
  const onPageChange = pagination?.onPageChange ?? setClientPage;
  const rows = pagination
    ? data
    : data.slice((currentClientPage - 1) * pageSize, currentClientPage * pageSize);

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableRowElement>, index: number) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        rowRefs.current[Math.min(index + 1, rows.length - 1)]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        rowRefs.current[Math.max(index - 1, 0)]?.focus();
      }
    },
    [rows.length]
  );

  const handleClick = (e: React.MouseEvent, item: T) => {
    if (!onRowClick || (e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    onRowClick(item);
  };

  const getAriaSortValue = (columnKey: string): React.AriaAttributes['aria-sort'] => {
    if (sorting?.column !== columnKey) return 'none';
    return sorting.direction === 'asc' ? 'ascending' : 'descending';
  };

  const renderSortIcon = (columnKey: string) => {
    if (sorting?.column !== columnKey) return <ChevronsUpDown className="h-3 w-3" />;
    return sorting.direction === 'asc' ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  // Loading state - usa skeleton para melhor perceived performance
  if (isLoading) {
    return (
      <LoadingState
        skeleton="table"
        skeletonConfig={{ rows: 5, columns: columns.length + (actions ? 1 : 0) }}
      />
    );
  }

  // Empty state
  if (data.length === 0) {
    return <EmptyState title={t('common.table.noData')} {...emptyState} />;
  }

  // Render column content
  const renderColumnContent = (item: T, column: Column<T>) =>
    column.render ? column.render(item) : String(item[column.key as keyof T] || '');

  return (
    <PageSlide
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      pinNav={pinNav}
      centerList={centerList}
      className="space-y-md"
    >
      {/* Mobile card list */}
      <div className="bg-card block overflow-hidden rounded-lg border md:hidden">
        <div className="divide-y">
          {rows.map((item) => (
            <div
              key={keyExtractor(item)}
              className={onRowClick ? 'cursor-pointer' : undefined}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={(e) => handleClick(e, item)}
              onKeyDown={(e) => {
                if (onRowClick && e.key === 'Enter' && e.target === e.currentTarget) {
                  onRowClick(item);
                }
              }}
            >
              {mobileCard ? (
                mobileCard(item)
              ) : (
                <div className="space-y-sm px-md py-3">
                  {columns.map((column) => (
                    <div
                      key={column.key}
                      className="gap-sm flex items-start justify-between"
                    >
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {column.label}
                      </span>
                      <span className={`text-sm ${getAlignClass(column.align)}`}>
                        {renderColumnContent(item, column)}
                      </span>
                    </div>
                  ))}
                  {actions && (
                    <div className="pt-xs flex justify-end">{actions(item)}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="bg-card hidden overflow-hidden rounded-lg border md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      column.sortable ? getAriaSortValue(column.key) : undefined
                    }
                    className={`${cellPad} ${getAlignClass(column.align)} text-sm font-semibold ${
                      column.className || ''
                    }`}
                  >
                    {column.sortable && sorting ? (
                      <button
                        type="button"
                        className="gap-xs hover:text-foreground/70 focus:ring-ring inline-flex items-center rounded focus:ring-2 focus:outline-none"
                        onClick={() => sorting.onSort(column.key)}
                      >
                        {column.label}
                        <span aria-hidden="true">{renderSortIcon(column.key)}</span>
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
                {actions && (
                  <th
                    scope="col"
                    className={`${cellPad} text-right text-sm font-semibold`}
                  >
                    {t('common.table.actions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              <AnimatePresence initial={false}>
                {rows.map((item, index) => {
                  const key = keyExtractor(item);
                  const isDeleting = deletingKeys?.has(key);
                  return (
                    <motion.tr
                      key={key}
                      ref={(el) => {
                        rowRefs.current[index] = el;
                      }}
                      tabIndex={0}
                      className={`hover:bg-muted/30 focus:bg-muted/40 transition-colors focus:outline-none ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(item) : ''}`}
                      onClick={(e: React.MouseEvent) => handleClick(e, item)}
                      onKeyDown={(e) => {
                        handleRowKeyDown(e, index);
                        if (
                          onRowClick &&
                          e.key === 'Enter' &&
                          e.target === e.currentTarget
                        ) {
                          onRowClick(item);
                        }
                      }}
                      animate={
                        isDeleting
                          ? { opacity: 0.4, scale: 0.99 }
                          : { opacity: 1, scale: 1 }
                      }
                      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                      layout
                    >
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={`${cellPad} ${getAlignClass(column.align)} ${
                            column.align === 'right' ? 'numeric' : ''
                          } ${column.className || ''}`}
                        >
                          {renderColumnContent(item, column)}
                        </td>
                      ))}
                      {actions && (
                        <td className={`${cellPad} text-right`}>{actions(item)}</td>
                      )}
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </PageSlide>
  );
}
