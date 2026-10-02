import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { FilterBar } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { Button } from '@/components/ui/button';
import { PlainButton } from '@/components/ui/plain-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    <PageContainer>
      <PageHeader
        title={t('pages.adminLogs.title')}
        icon={<ScrollText />}
        actions={
          <button
            onClick={() => void refetch()}
            disabled={isLoading}
            className="gap-sm border-border bg-card py-sm text-foreground hover:bg-accent flex items-center rounded-lg border px-3 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            {t('pages.adminLogs.refresh')}
          </button>
        }
      />

      <FilterBar hasActiveFilters={hasFilters} onClear={clearFilters}>
        <SearchInput
          placeholder={t('pages.adminLogs.userPlaceholder')}
          value={username}
          onValueChange={setUsername}
        />
        <Select
          value={action || 'all'}
          onValueChange={(v) => setAction(v === 'all' ? '' : v)}
        >
          <SelectTrigger aria-label={t('pages.adminLogs.allActions')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pages.adminLogs.allActions')}</SelectItem>
            {Object.keys(ACTION_KEYS).map((k) => (
              <SelectItem key={k} value={k}>
                {t(`pages.adminLogs.actions.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangeFilter
          startDate={dateFrom}
          endDate={dateTo}
          onStartChange={(date) => setDateFrom(date ? formatLocalDate(date) : '')}
          onEndChange={(date) => setDateTo(date ? formatLocalDate(date) : '')}
        />
        <Button size="sm" onClick={applyFilters}>
          {t('pages.adminLogs.applyFilters')}
        </Button>
      </FilterBar>

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
              <PlainButton
                aria-label={t('common.table.previousPage')}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border-border p-sm text-muted-foreground hover:bg-accent rounded-lg border disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </PlainButton>
              <PlainButton
                aria-label={t('common.table.nextPage')}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="border-border p-sm text-muted-foreground hover:bg-accent rounded-lg border disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </PlainButton>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
