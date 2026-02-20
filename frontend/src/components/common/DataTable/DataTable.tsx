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
 * - Suporte a paginação (futura implementação)
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

import React from 'react';
import { LoadingState } from '../LoadingState';
import { EmptyState } from '../EmptyState';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (item: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
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
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  emptyState,
  pagination,
  actions,
}: DataTableProps<T>) {
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
        <p>Nenhum registro encontrado.</p>
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
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`px-6 py-4 ${getAlignClass(column.align)} text-sm font-semibold ${
                      column.className || ''
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
                {actions && (
                  <th scope="col" className="px-6 py-4 text-right text-sm font-semibold">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className="transition-colors hover:bg-muted/30"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-6 py-4 ${getAlignClass(column.align)} ${
                        column.className || ''
                      }`}
                    >
                      {renderColumnContent(item, column)}
                    </td>
                  ))}
                  {actions && <td className="px-6 py-4">{actions(item)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination (placeholder para futura implementação) */}
      {pagination && (
        <div className="flex items-center justify-between">
          <p className="text-sm">
            Mostrando {Math.min(pagination.pageSize, pagination.total)} de{' '}
            {pagination.total} registros
          </p>
          <div className="flex gap-2">{/* Pagination controls aqui */}</div>
        </div>
      )}
    </div>
  );
}
