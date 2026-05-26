import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import {
  ScrollText,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Key,
  Download,
  LogIn,
  LogOut,
  ShieldAlert,
  Share2,
  Activity,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import type { ElementType } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
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

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const dateFnsLocale: Locale = i18n.language === 'pt-BR' ? ptBR : enUS;

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await activityLogsService.getAll();
      setLogs(data);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const groupedLogs = useMemo(() => {
    const map = new Map<string, ActivityLog[]>();
    for (const log of logs) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, dateFnsLocale]);

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader title={t('pages.activityLogs.title')} icon={<ScrollText />} />

      {logs.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-12 w-12 text-muted-foreground" />}
          message={t('pages.activityLogs.emptyState')}
        />
      ) : (
        <div className="space-y-lg">
          {groupedLogs.map(({ dateKey, dateLabel, items }) => (
            <div key={dateKey} className="space-y-xs">
              <div className="mb-sm flex items-center gap-sm px-xs">
                <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium capitalize text-muted-foreground">
                  {dateLabel}
                </span>
                <div className="flex-1 border-t border-border/50" />
              </div>

              <div className="divide-y divide-border/40 rounded-lg border bg-card">
                {items.map((log) => {
                  const config = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.other;
                  const Icon = config.Icon;
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-md py-3">
                      <div
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          config.dot
                        )}
                      >
                        <Icon className={cn('h-3.5 w-3.5', config.iconColor)} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-xs">
                        <div className="flex flex-wrap items-center gap-sm">
                          <Badge variant="outline" className={config.badge}>
                            {t(`pages.adminLogs.actions.${log.action}`, {
                              defaultValue: log.action_display,
                            })}
                          </Badge>
                          <span className="text-sm text-foreground">
                            {log.description_key
                              ? t(`activityDescriptions.${log.description_key}`, {
                                  ...(log.description_params ?? {}),
                                  defaultValue: log.description,
                                })
                              : log.description}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {format(new Date(log.created_at), 'HH:mm:ss', {
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
          ))}
        </div>
      )}
    </PageContainer>
  );
}
