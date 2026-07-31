import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Filter, RefreshCw, Search, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DatePicker } from '@/components/ui/date-picker';
import i18n from '@/i18n';
import { cn, formatLocalDate } from '@/lib/utils';
import { adminService } from '@/services/admin-service';

import { LogRow } from './AdminLogsComponents';
import { ACTION_KEYS } from './AdminLogsConstants';

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
      <div className="mb-lg flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">
            {t('pages.adminLogs.title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {data
              ? t('pages.adminLogs.subtitle', {
                  records: data.count.toLocaleString(i18n.language),
                })
              : t('pages.adminLogs.loading')}
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isLoading}
          className="gap-sm border-border bg-card py-sm text-foreground hover:bg-accent flex items-center rounded-lg border px-3 text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          {t('pages.adminLogs.refresh')}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-md border-border bg-card p-md rounded-lg border">
        <div className="gap-sm mb-3 flex items-center">
          <Filter className="text-muted-foreground h-4 w-4" />
          <span className="text-foreground text-sm font-medium">
            {t('pages.adminLogs.filters')}
          </span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="gap-xs text-muted-foreground hover:text-foreground ml-auto flex items-center text-xs"
            >
              <X className="h-3 w-3" /> {t('pages.adminLogs.clearFilters')}
            </button>
          )}
        </div>
        <div className="gap-md grid sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('pages.adminLogs.userPlaceholder')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border-border bg-background py-sm pl-xl text-foreground focus:ring-primary w-full rounded-lg border pr-3 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="border-border bg-background py-sm text-foreground focus:ring-primary rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
          >
            <option value="">{t('pages.adminLogs.allActions')}</option>
            {Object.keys(ACTION_KEYS).map((k) => (
              <option key={k} value={k}>
                {t(`pages.adminLogs.actions.${k}`)}
              </option>
            ))}
          </select>
          <DatePicker
            value={dateFrom}
            onChange={(date) => setDateFrom(date ? formatLocalDate(date) : '')}
            clearable
          />
          <DatePicker
            value={dateTo}
            onChange={(date) => setDateTo(date ? formatLocalDate(date) : '')}
            clearable
          />
        </div>
        <button
          onClick={applyFilters}
          className="bg-primary px-md py-sm text-primary-foreground hover:bg-primary/90 mt-3 rounded-lg text-sm font-medium"
        >
          {t('pages.adminLogs.applyFilters')}
        </button>
      </div>

      {/* Table */}
      <div className="border-border bg-card overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-border bg-secondary/50 border-b">
                <th className="px-md text-muted-foreground py-3 text-left text-xs font-medium tracking-wide uppercase">
                  {t('pages.adminLogs.columns.datetime')}
                </th>
                <th className="px-md text-muted-foreground py-3 text-left text-xs font-medium tracking-wide uppercase">
                  {t('pages.adminLogs.columns.user')}
                </th>
                <th className="px-md text-muted-foreground py-3 text-left text-xs font-medium tracking-wide uppercase">
                  {t('pages.adminLogs.columns.action')}
                </th>
                <th className="px-md text-muted-foreground py-3 text-left text-xs font-medium tracking-wide uppercase">
                  {t('pages.adminLogs.columns.model')}
                </th>
                <th className="px-md text-muted-foreground py-3 text-left text-xs font-medium tracking-wide uppercase">
                  {t('pages.adminLogs.columns.description')}
                </th>
                <th className="px-md text-muted-foreground py-3 text-left text-xs font-medium tracking-wide uppercase">
                  {t('pages.adminLogs.columns.ip')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground py-12 text-center">
                    <RefreshCw className="mb-sm mx-auto h-6 w-6 animate-spin" />
                    {t('pages.adminLogs.loadingLogs')}
                  </td>
                </tr>
              ) : data?.results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground py-12 text-center">
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
          <div className="border-border px-md flex items-center justify-between border-t py-3">
            <p className="text-muted-foreground text-sm">
              {t('pages.adminLogs.page', {
                page,
                total: totalPages,
                records: data?.count.toLocaleString(i18n.language),
              })}
            </p>
            <div className="gap-sm flex items-center">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border-border p-sm text-muted-foreground hover:bg-accent rounded-lg border disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="border-border p-sm text-muted-foreground hover:bg-accent rounded-lg border disabled:opacity-40"
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
