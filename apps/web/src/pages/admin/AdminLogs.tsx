import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarDays, RefreshCw, ScrollText, User, Zap } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { LIST_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import { adminService } from '@/services/admin-service';
import type { AdminLog } from '@/types';

import { ActionBadge } from './AdminLogsComponents';
import { ACTION_KEYS } from './AdminLogsConstants';

export default function AdminLogs() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [username, setUsername] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const deferredUsername = useDeferredValue(username);
  const filters = { username: deferredUsername, action, dateFrom, dateTo };
  const hasFilters = Object.values(filters).some(Boolean);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'logs', page, filters],
    queryFn: () =>
      adminService.getLogs({
        page,
        page_size: LIST_PAGE_SIZE,
        username: filters.username || undefined,
        action: filters.action || undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
      }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // Filtro novo volta para a 1ª página.
  const withReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const clearFilters = () => {
    setUsername('');
    setAction('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const columns: Column<AdminLog>[] = [
    {
      key: 'created_at',
      label: t('pages.adminLogs.columns.datetime'),
      className: 'whitespace-nowrap',
      render: (log) => {
        const date = new Date(log.created_at);
        return `${formatDate(date)} ${formatDate(date, 'HH:mm')}`;
      },
    },
    {
      key: 'username',
      label: t('pages.adminLogs.columns.user'),
      render: (log) => <span className="font-medium">{log.username ?? '—'}</span>,
    },
    {
      key: 'action',
      label: t('pages.adminLogs.columns.action'),
      render: (log) => <ActionBadge action={log.action} display={log.action_display} />,
    },
    {
      key: 'model_name',
      label: t('pages.adminLogs.columns.model'),
      render: (log) => log.model_name ?? '—',
    },
    {
      key: 'description',
      label: t('pages.adminLogs.columns.description'),
      render: (log) => (
        <span className="block max-w-96 truncate" title={log.description}>
          {log.description}
        </span>
      ),
    },
    {
      key: 'ip_address',
      label: t('pages.adminLogs.columns.ip'),
      className: 'whitespace-nowrap',
      render: (log) => log.ip_address ?? '—',
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.adminLogs.title')}
        icon={<ScrollText />}
        actions={
          <Button variant="outline" onClick={() => void refetch()} loading={isFetching}>
            {!isFetching && <RefreshCw />}
            {t('pages.adminLogs.refresh')}
          </Button>
        }
      />

      <FilterBar hasActiveFilters={hasFilters} onClear={clearFilters}>
        <FilterField label={t('common.filterLabels.user')} icon={User}>
          <SearchInput
            placeholder={t('pages.adminLogs.userPlaceholder')}
            value={username}
            onValueChange={withReset(setUsername)}
          />
        </FilterField>
        <FilterField label={t('common.filterLabels.action')} icon={Zap}>
          <Select
            value={action || 'all'}
            onValueChange={(v) => withReset(setAction)(v === 'all' ? '' : v)}
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
        </FilterField>
        <FilterField label={t('common.filterLabels.period')} icon={CalendarDays}>
          <DateRangeFilter
            startDate={dateFrom}
            endDate={dateTo}
            onStartChange={(date) =>
              withReset(setDateFrom)(date ? formatLocalDate(date) : '')
            }
            onEndChange={(date) =>
              withReset(setDateTo)(date ? formatLocalDate(date) : '')
            }
          />
        </FilterField>
      </FilterBar>

      <DataTable
        data={data?.results ?? []}
        columns={columns}
        keyExtractor={(log) => log.id}
        isLoading={isLoading}
        emptyState={{
          icon: <ScrollText className="text-muted-foreground h-12 w-12" />,
          title: t('pages.adminLogs.noLogs'),
        }}
        pagination={{
          page,
          pageSize: LIST_PAGE_SIZE,
          total: data?.count ?? 0,
          onPageChange: setPage,
        }}
      />
    </PageContainer>
  );
}
