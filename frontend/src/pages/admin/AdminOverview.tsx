import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  Mail,
  RefreshCw,
  Server,
  Wifi,
  XCircle,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { adminService } from '@/services/admin-service';
import type { ServiceCheck, ServiceStatus } from '@/types';

const statusConfig: Record<
  ServiceStatus,
  { icon: React.ElementType; color: string; statusKey: string }
> = {
  healthy: { icon: CheckCircle2, color: 'text-green-500', statusKey: 'healthy' },
  unhealthy: { icon: XCircle, color: 'text-destructive', statusKey: 'unhealthy' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', statusKey: 'warning' },
  not_configured: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    statusKey: 'not_configured',
  },
  unknown: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    statusKey: 'unknown',
  },
  not_active: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    statusKey: 'not_active',
  },
};

interface ServiceCardProps {
  name: string;
  icon: React.ElementType;
  check: ServiceCheck | undefined;
  loading: boolean;
}

function ServiceCard({ name, icon: Icon, check, loading }: ServiceCardProps) {
  const { t } = useTranslation();
  const s = check?.status ?? 'unknown';
  const cfg = statusConfig[s] ?? statusConfig.unknown;
  const StatusIcon = cfg.icon;

  const messageText = check?.message_key
    ? t(`pages.adminOverview.messages.${check.message_key}`, {
        count: check.model_count,
        percent: check.free_percent,
        host: check.smtp_host,
        port: check.smtp_port,
      })
    : check?.message;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-md flex items-center justify-between">
        <div className="flex items-center gap-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium text-foreground">{name}</span>
        </div>
        {loading ? (
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <StatusIcon className={cn('h-5 w-5', cfg.color)} />
        )}
      </div>
      <p className={cn('text-sm font-medium', cfg.color)}>
        {t(`pages.adminOverview.status.${cfg.statusKey}`)}
      </p>
      {messageText && (
        <p className="mt-xs line-clamp-2 text-xs text-muted-foreground">
          {messageText}
        </p>
      )}
      {check?.free_percent !== undefined && (
        <div className="mt-sm">
          <div className="h-1.5 w-full rounded-full bg-secondary">
            <div
              className={cn(
                'h-1.5 rounded-full transition-all',
                check.free_percent < 10 ? 'bg-destructive' : 'bg-green-500'
              )}
              style={{ width: `${check.free_percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminOverview() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: () => adminService.getHealth(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString(i18n.language)
    : null;

  return (
    <div>
      <div className="mb-lg flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('pages.adminOverview.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('pages.adminOverview.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              {t('pages.adminOverview.updatedAt', { time: lastUpdate })}
            </span>
          )}
          <button
            onClick={() => void refetch()}
            disabled={isLoading}
            className="flex items-center gap-sm rounded-lg border border-border bg-card px-3 py-sm text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            {t('pages.adminOverview.refresh')}
          </button>
        </div>
      </div>

      {/* Overall status banner */}
      {data && (
        <div
          className={cn(
            'mb-lg flex items-center gap-3 rounded-lg border px-5 py-md',
            data.status === 'healthy' && 'border-green-500/30 bg-green-500/10',
            data.status === 'warning' && 'border-yellow-500/30 bg-yellow-500/10',
            data.status === 'unhealthy' && 'border-destructive/30 bg-destructive/10'
          )}
        >
          {data.status === 'healthy' && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          {data.status === 'warning' && (
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          )}
          {data.status === 'unhealthy' && (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
          <div>
            <p className="font-semibold text-foreground">
              {data.status === 'healthy' && t('pages.adminOverview.statusHealthy')}
              {data.status === 'warning' && t('pages.adminOverview.statusWarning')}
              {data.status === 'unhealthy' && t('pages.adminOverview.statusUnhealthy')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('pages.adminOverview.checkedAt', {
                time: new Date(data.timestamp).toLocaleString(i18n.language),
              })}
            </p>
          </div>
        </div>
      )}

      {/* Service cards grid */}
      <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
        <ServiceCard
          name={t('pages.adminOverview.services.database')}
          icon={Database}
          check={data?.checks.database}
          loading={isLoading}
        />
        <ServiceCard
          name={t('pages.adminOverview.services.cache')}
          icon={Zap}
          check={data?.checks.cache}
          loading={isLoading}
        />
        <ServiceCard
          name={t('pages.adminOverview.services.storage')}
          icon={HardDrive}
          check={data?.checks.storage}
          loading={isLoading}
        />
        <ServiceCard
          name={t('pages.adminOverview.services.ollama')}
          icon={Server}
          check={data?.checks.ollama}
          loading={isLoading}
        />
        <ServiceCard
          name={t('pages.adminOverview.services.email')}
          icon={Mail}
          check={data?.checks.email}
          loading={isLoading}
        />
        <ServiceCard
          name={t('pages.adminOverview.services.disk')}
          icon={Wifi}
          check={data?.checks.disk}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
