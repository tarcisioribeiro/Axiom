/* eslint-disable max-lines */
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
 * - Suporte a paginação com navegação Anterior/Próximo
 *
 * @example
 * ```tsx
 * const columns: Column<Account>[] = [
 *   { key: 'name', label: 'Nome', render: (item) => <div>{item.name}</div> },
 *   { key: 'balance', label: 'Saldo', align: 'right', render: (item) => formatCurrency(item.balance) },
 * ];
 *
 * <DataTable
 *   data={accounts}
 *   columns={columns}
 *   keyExtractor={(item) => item.id}
 *   isLoading={isLoading}
 *   emptyState={{ message: 'Nenhuma conta encontrada' }}
 *   actions={(item) => <EditButton onClick={() => handleEdit(item)} />}
 * />
 * ```
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
} from 'lucide-react';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import { EmptyState } from '../EmptyState';
import { LoadingState } from '../LoadingState';

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
  emptyState?: {
    icon?: React.ReactNode;
    title?: string;
    message: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  sorting?: {
    column: string | null;
    direction: 'asc' | 'desc' | null;
    onSort: (column: string) => void;
  };
  actions?: (item: T) => React.ReactNode;
  rowClassName?: (item: T) => string;
  /** Row keys that are currently being deleted (fade + collapse animation) */
  deletingKeys?: Set<string | number>;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  density = 'comfortable',
  emptyState,
  pagination,
  sorting,
  actions,
  rowClassName,
  deletingKeys,
}: DataTableProps<T>) {
  const cellPad = density === 'compact' ? 'px-md py-sm' : 'px-lg py-md';
  const { t } = useTranslation();
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableRowElement>, index: number) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        rowRefs.current[Math.min(index + 1, data.length - 1)]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        rowRefs.current[Math.max(index - 1, 0)]?.focus();
      }
    },
    [data.length]
  );

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
    if (emptyState) {
      return <EmptyState {...emptyState} />;
    }
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p>{t('common.table.noData')}</p>
      </div>
    );
  }

  // Render column content
  const renderColumnContent = (item: T, column: Column<T>) => {
    if (column.render) {
      return column.render(item);
    }
    return String(item[column.key as keyof T] || '');
  };

  // Get alignment class
  const getAlignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  return (
    <div className="space-y-md">
      {/* Mobile card list */}
      <div className="block overflow-hidden rounded-lg border bg-card md:hidden">
        <div className="divide-y">
          {data.map((item) => (
            <div key={keyExtractor(item)} className="space-y-sm px-md py-3">
              {columns.map((column) => (
                <div
                  key={column.key}
                  className="flex items-start justify-between gap-sm"
                >
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {column.label}
                  </span>
                  <span className={`text-sm ${getAlignClass(column.align)}`}>
                    {renderColumnContent(item, column)}
                  </span>
                </div>
              ))}
              {actions && <div className="flex justify-end pt-xs">{actions(item)}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
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
                        className="inline-flex items-center gap-xs rounded hover:text-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
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
                {data.map((item, index) => {
                  const key = keyExtractor(item);
                  const isDeleting = deletingKeys?.has(key);
                  return (
                    <motion.tr
                      key={key}
                      ref={(el) => {
                        rowRefs.current[index] = el;
                      }}
                      tabIndex={0}
                      className={`transition-colors hover:bg-muted/30 focus:bg-muted/40 focus:outline-none ${rowClassName ? rowClassName(item) : ''}`}
                      onKeyDown={(e) => handleRowKeyDown(e, index)}
                      animate={
                        isDeleting
                          ? { opacity: 0.4, scale: 0.99 }
                          : { opacity: 1, scale: 1 }
                      }
                      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                      transition={{ duration: 0.2 }}
                      layout
                    >
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={`${cellPad} ${getAlignClass(column.align)} ${
                            column.className || ''
                          }`}
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

      {pagination &&
        (() => {
          const totalPages = Math.ceil(pagination.total / pagination.pageSize);
          const isFirst = pagination.page <= 1;
          const isLast = pagination.page >= totalPages;
          const currentCount = Math.min(
            pagination.pageSize,
            pagination.total - (pagination.page - 1) * pagination.pageSize
          );
          return (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('common.table.showing', {
                  count: currentCount,
                  total: pagination.total,
                })}
              </p>
              <div className="flex items-center gap-sm">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t('common.table.previousPage')}
                  disabled={isFirst}
                  onClick={() => pagination.onPageChange(pagination.page - 1)}
                >
                  <ChevronLeft />
                </Button>
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  {t('common.table.pageOf', { page: pagination.page, totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t('common.table.nextPage')}
                  disabled={isLast}
                  onClick={() => pagination.onPageChange(pagination.page + 1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
