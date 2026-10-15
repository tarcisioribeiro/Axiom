/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import {
  Activity,
  Calendar,
  CalendarDays,
  Download,
  Eye,
  FileDown,
  Key,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  ScrollText,
  Search,
  Share2,
  ShieldAlert,
  Trash2,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import type { ElementType } from 'react';
import { useTranslation } from 'react-i18next';

import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, LIST_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { activityLogsService } from '@/services/activity-logs-service';
import type { ActivityLog } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type ActionConfig = {
  badge: string;
  dot: string;
  iconColor: string;
  Icon: ElementType;
};

const ACTION_CONFIG: Record<string, ActionConfig> = {
  create: {
    badge: 'bg-success/10 text-success border-success/25',
    dot: 'bg-success/15',
    iconColor: 'text-success',
    Icon: Plus,
  },
  update: {
    badge: 'bg-warning/10 text-warning border-warning/25',
    dot: 'bg-warning/15',
    iconColor: 'text-warning',
    Icon: Pencil,
  },
  delete: {
    badge: 'bg-destructive/10 text-destructive border-destructive/25',
    dot: 'bg-destructive/15',
    iconColor: 'text-destructive',
    Icon: Trash2,
  },
  purge: {
    badge: 'bg-destructive/10 text-destructive border-destructive/25',
    dot: 'bg-destructive/15',
    iconColor: 'text-destructive',
    Icon: Trash2,
  },
  view: {
    badge: 'bg-info/10 text-info border-info/25',
    dot: 'bg-info/15',
    iconColor: 'text-info',
    Icon: Eye,
  },
  reveal: {
    badge: 'bg-primary/10 text-primary border-primary/25',
    dot: 'bg-primary/15',
    iconColor: 'text-primary',
    Icon: Key,
  },
  shared_reveal: {
    badge: 'bg-primary/10 text-primary border-primary/25',
    dot: 'bg-primary/15',
    iconColor: 'text-primary',
    Icon: Share2,
  },
  download: {
    badge: 'bg-accent/10 text-accent border-accent/25',
    dot: 'bg-accent/15',
    iconColor: 'text-accent',
    Icon: Download,
  },
  login: {
    badge: 'bg-success/10 text-success border-success/25',
    dot: 'bg-success/15',
    iconColor: 'text-success',
    Icon: LogIn,
  },
  logout: {
    badge: 'bg-secondary text-secondary-foreground border-border',
    dot: 'bg-muted',
    iconColor: 'text-muted-foreground',
    Icon: LogOut,
  },
  failed_login: {
    badge: 'bg-destructive/10 text-destructive border-destructive/25',
    dot: 'bg-destructive/15',
    iconColor: 'text-destructive',
    Icon: ShieldAlert,
  },
  failed_vault_unlock: {
    badge: 'bg-destructive/10 text-destructive border-destructive/25',
    dot: 'bg-destructive/15',
    iconColor: 'text-destructive',
    Icon: ShieldAlert,
  },
  other: {
    badge: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted',
    iconColor: 'text-muted-foreground',
    Icon: Activity,
  },
};

const ACTION_KEYS = Object.keys(ACTION_CONFIG);

export default function ActivityLogs() {
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const dateFnsLocale: Locale = i18n.language === 'pt-BR' ? ptBR : enUS;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: async () => {
      try {
        return await activityLogsService.getAll();
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return [] as ActivityLog[];
      }
    },
  });

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    if (searchTerm && !log.description.toLowerCase().includes(searchTerm.toLowerCase()))
      return false;
    const logDate = new Date(log.created_at);
    if (startDate && logDate < startDate) return false;
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      if (logDate > endOfDay) return false;
    }
    return true;
  });

  const hasActiveFilters =
    searchTerm !== '' || actionFilter !== 'all' || !!startDate || !!endDate;

  const clearFilters = () => {
    setSearchTerm('');
    setActionFilter('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  // Agrupa por dia só os logs da página atual.
  const groupByDay = (pageLogs: ActivityLog[]) => {
    const map = new Map<string, ActivityLog[]>();
    for (const log of pageLogs) {
      const key = format(new Date(log.created_at), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      dateKey: key,
      dateLabel: format(
        new Date(key + 'T12:00:00'),
        t('pages.activityLogs.dateGroupFormat'),
        { locale: dateFnsLocale }
      ),
      items,
    }));
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await activityLogsService.exportCSV();
      toast({ title: t('pages.activityLogs.exportSuccess') });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.exportError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader title={t('pages.activityLogs.title')} icon={<ScrollText />}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleExport()}
          disabled={logs.length === 0}
          loading={isExporting}
          className="gap-xs"
        >
          {!isExporting && <FileDown className="h-4 w-4" />}
          {t('pages.activityLogs.exportBtn')}
        </Button>
      </PageHeader>

      {logs.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="text-muted-foreground h-12 w-12" />}
          title={t('pages.activityLogs.emptyState')}
        />
      ) : (
        <>
          <FilterBar
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            activeFilters={[
              ...(actionFilter !== 'all'
                ? [
                    {
                      key: 'action',
                      label: `${t('pages.activityLogs.allActions')}: ${t(`pages.adminLogs.actions.${actionFilter}`)}`,
                      onRemove: () => setActionFilter('all'),
                    },
                  ]
                : []),
              ...(startDate
                ? [
                    {
                      key: 'startDate',
                      label: `${t('common.fields.from')}: ${formatDate(startDate)}`,
                      onRemove: () => setStartDate(undefined),
                    },
                  ]
                : []),
              ...(endDate
                ? [
                    {
                      key: 'endDate',
                      label: `${t('common.fields.to')}: ${formatDate(endDate)}`,
                      onRemove: () => setEndDate(undefined),
                    },
                  ]
                : []),
            ]}
          >
            <FilterField label={t('common.filterLabels.search')} icon={Search}>
              <SearchInput
                placeholder={t('pages.activityLogs.searchPlaceholder')}
                value={searchTerm}
                onValueChange={setSearchTerm}
                className="w-44"
              />
            </FilterField>
            <FilterField label={t('common.filterLabels.action')} icon={Zap}>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger
                  className="w-44"
                  aria-label={t('pages.activityLogs.allActions')}
                  startIcon={<Activity className="h-3.5 w-3.5" />}
                >
                  <SelectValue placeholder={t('pages.activityLogs.allActions')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('pages.activityLogs.allActions')}
                  </SelectItem>
                  {ACTION_KEYS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {t(`pages.adminLogs.actions.${action}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label={t('common.filterLabels.period')} icon={CalendarDays}>
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onStartChange={setStartDate}
                onEndChange={setEndDate}
              />
            </FilterField>
          </FilterBar>

          {filteredLogs.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="text-muted-foreground h-12 w-12" />}
              title={t('pages.activityLogs.emptyState')}
            />
          ) : (
            <PaginatedSlide
              items={filteredLogs}
              pageSize={LIST_PAGE_SIZE}
              className="space-y-lg"
            >
              {(pageItems) =>
                groupByDay(pageItems).map(({ dateKey, dateLabel, items }) => (
                  <div key={dateKey} className="space-y-xs">
                    <div className="mb-sm gap-sm px-xs flex items-center">
                      <Calendar className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span className="text-muted-foreground text-sm font-medium capitalize">
                        {dateLabel}
                      </span>
                      <div className="border-border/50 flex-1 border-t" />
                    </div>

                    <div className="divide-border/40 bg-card divide-y rounded-lg border">
                      {items.map((log) => {
                        const config = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.other;
                        const Icon = config.Icon;
                        return (
                          <div
                            key={log.id}
                            className="px-md flex items-start gap-3 py-3"
                          >
                            <div
                              className={cn(
                                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                                config.dot
                              )}
                            >
                              <Icon className={cn('h-3.5 w-3.5', config.iconColor)} />
                            </div>
                            <div className="space-y-xs min-w-0 flex-1">
                              <div className="gap-sm flex flex-wrap items-center">
                                <Badge variant="outline" className={config.badge}>
                                  {t(`pages.adminLogs.actions.${log.action}`, {
                                    defaultValue: log.action_display,
                                  })}
                                </Badge>
                                <span className="text-foreground text-sm">
                                  {log.description_key
                                    ? t(`activityDescriptions.${log.description_key}`, {
                                        ...(log.description_params ?? {}),
                                        defaultValue: log.description,
                                      })
                                    : log.description}
                                </span>
                              </div>
                              <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                                <span>
                                  {format(new Date(log.created_at), 'HH:mm', {
                                    locale: dateFnsLocale,
                                  })}
                                </span>
                                {log.ip_address && <span>· {log.ip_address}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              }
            </PaginatedSlide>
          )}
        </>
      )}
    </PageContainer>
  );
}
