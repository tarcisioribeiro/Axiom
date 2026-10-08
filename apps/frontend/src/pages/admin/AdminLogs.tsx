import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { RefreshCw, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PageSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    placeholderData: keepPreviousData,
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

      <PageSlide page={page} totalPages={totalPages} onPageChange={setPage}>
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
                      <EmptyState
                        icon={<ScrollText className="h-6 w-6" />}
                        title={t('pages.adminLogs.noLogs')}
                      />
                    </td>
                  </tr>
                ) : (
                  data?.results.map((log) => <LogRow key={log.id} log={log} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageSlide>
    </PageContainer>
  );
}
