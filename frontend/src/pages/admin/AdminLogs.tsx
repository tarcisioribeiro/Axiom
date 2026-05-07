import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Filter, RefreshCw, Search, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { adminService } from '@/services/admin-service';
import type { AdminLog } from '@/types';

const ACTION_KEYS: Record<string, string> = {
  view: 'view',
  create: 'create',
  update: 'update',
  delete: 'delete',
  reveal: 'reveal',
  download: 'download',
  login: 'login',
  logout: 'logout',
  failed_login: 'failed_login',
  failed_vault_unlock: 'failed_vault_unlock',
  other: 'other',
  purge: 'purge',
  shared_reveal: 'shared_reveal',
};

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-green-500/10 text-green-700 dark:text-green-400',
  logout: 'bg-secondary text-muted-foreground',
  create: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  update: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  delete: 'bg-destructive/10 text-destructive',
  reveal: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  download: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  failed_login: 'bg-destructive/10 text-destructive',
  failed_vault_unlock: 'bg-destructive/10 text-destructive',
  purge: 'bg-red-900/20 text-red-600 dark:text-red-400',
  shared_reveal: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  view: 'bg-secondary text-muted-foreground',
  other: 'bg-secondary text-muted-foreground',
};

function ActionBadge({ action, display }: { action: string; display: string }) {
  const { t } = useTranslation();
  const key = ACTION_KEYS[action];
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        ACTION_COLORS[action] ?? 'bg-secondary text-muted-foreground'
      )}
    >
      {display || (key ? t(`pages.adminLogs.actions.${key}`) : action)}
    </span>
  );
}

function LogRow({ log }: { log: AdminLog }) {
  const date = new Date(log.created_at);
  return (
    <tr className="border-b border-border transition-colors hover:bg-accent/30">
      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
        <div>{date.toLocaleDateString('pt-BR')}</div>
        <div className="font-mono">{date.toLocaleTimeString('pt-BR')}</div>
      </td>
      <td className="px-4 py-3">
        <span className="font-medium text-foreground">{log.username ?? '—'}</span>
      </td>
      <td className="px-4 py-3">
        <ActionBadge action={log.action} display={log.action_display} />
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {log.model_name ?? '—'}
      </td>
      <td className="max-w-xs px-4 py-3 text-sm text-foreground">
        <span className="line-clamp-2">{log.description}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
        {log.ip_address ?? '—'}
      </td>
    </tr>
  );
}

export default function AdminLogs() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [username, setUsername] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<{
    username: string;
    action: string;
    dateFrom: string;
    dateTo: string;
  }>({ username: '', action: '', dateFrom: '', dateTo: '' });

  const hasFilters = Object.values(appliedFilters).some(Boolean);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'logs', page, pageSize, appliedFilters],
    queryFn: () =>
      adminService.getLogs({
        page,
        page_size: pageSize,
        username: appliedFilters.username || undefined,
        action: appliedFilters.action || undefined,
        date_from: appliedFilters.dateFrom || undefined,
        date_to: appliedFilters.dateTo || undefined,
      }),
    staleTime: 30_000,
  });

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({ username, action, dateFrom, dateTo });
  };

  const clearFilters = () => {
    setUsername('');
    setAction('');
    setDateFrom('');
    setDateTo('');
    setAppliedFilters({ username: '', action: '', dateFrom: '', dateTo: '' });
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.count / pageSize) : 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('pages.adminLogs.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? t('pages.adminLogs.subtitle', {
                  records: data.count.toLocaleString('pt-BR'),
                })
              : t('pages.adminLogs.loading')}
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          {t('pages.adminLogs.refresh')}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {t('pages.adminLogs.filters')}
          </span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> {t('pages.adminLogs.clearFilters')}
            </button>
          )}
        </div>
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('pages.adminLogs.userPlaceholder')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('pages.adminLogs.allActions')}</option>
            {Object.keys(ACTION_KEYS).map((k) => (
              <option key={k} value={k}>
                {t(`pages.adminLogs.actions.${k}`)}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={applyFilters}
          className="mt-3 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('pages.adminLogs.applyFilters')}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('pages.adminLogs.columns.datetime')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('pages.adminLogs.columns.user')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('pages.adminLogs.columns.action')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('pages.adminLogs.columns.model')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('pages.adminLogs.columns.description')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('pages.adminLogs.columns.ip')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin" />
                    {t('pages.adminLogs.loadingLogs')}
                  </td>
                </tr>
              ) : data?.results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    {t('pages.adminLogs.noLogs')}
                  </td>
                </tr>
              ) : (
                data?.results.map((log) => <LogRow key={log.id} log={log} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {t('pages.adminLogs.page', {
                page,
                total: totalPages,
                records: data?.count.toLocaleString('pt-BR'),
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
