import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Archive,
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  Mail,
  RefreshCw,
  Server,
  XCircle,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { adminService } from '@/services/admin-service';
import type { ServiceCheck, ServiceStatus } from '@/types';

const statusConfig: Record<
  ServiceStatus,
  { icon: React.ElementType; color: string; variant: BadgeProps['variant'] }
> = {
  healthy: { icon: CheckCircle2, color: 'text-success', variant: 'success' },
  unhealthy: { icon: XCircle, color: 'text-destructive', variant: 'destructive' },
  warning: { icon: AlertTriangle, color: 'text-warning', variant: 'warning' },
  not_configured: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    variant: 'secondary',
  },
  unknown: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    variant: 'secondary',
  },
  not_active: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    variant: 'secondary',
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

  const messageText = check?.message_key
    ? t(`pages.adminOverview.messages.${check.message_key}`, {
        count: check.model_count,
        percent: check.free_percent,
        host: check.smtp_host,
        port: check.smtp_port,
      })
    : check?.message;

  return (
    <div className="border-border bg-card p-md space-y-sm rounded-lg border">
      <div className="gap-sm flex items-center justify-between">
        <div className="gap-sm flex min-w-0 items-center">
          <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Icon className="text-primary h-4 w-4" />
          </div>
          <span className="text-foreground truncate font-medium">{name}</span>
        </div>
        {loading ? (
          <RefreshCw className="text-muted-foreground h-4 w-4 animate-spin" />
        ) : (
          <Badge variant={cfg.variant}>{t(`pages.adminOverview.status.${s}`)}</Badge>
        )}
      </div>
      {messageText && (
        <p className="text-muted-foreground truncate text-xs" title={messageText}>
          {messageText}
        </p>
      )}
      {check?.free_percent !== undefined && (
        <Progress
          value={check.free_percent}
          className="h-1.5"
          indicatorClassName={check.free_percent < 10 ? 'bg-destructive' : 'bg-success'}
        />
      )}
    </div>
  );
}

export default function AdminOverview() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: () => adminService.getHealth(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.adminOverview.title')}
        icon={<Activity />}
        actions={
          <Button variant="outline" onClick={() => void refetch()} loading={isFetching}>
            {!isFetching && <RefreshCw />}
            {t('pages.adminOverview.refresh')}
          </Button>
        }
      />

      {/* Overall status banner */}
      {data && (
        <div className="border-border bg-card py-md px-md gap-md flex items-center rounded-lg border">
          {(() => {
            const { icon: StatusIcon, color } =
              statusConfig[data.status] ?? statusConfig.unknown;
            return <StatusIcon className={cn('h-5 w-5 shrink-0', color)} />;
          })()}
          <div>
            <p className="text-foreground font-semibold">
              {data.status === 'healthy' && t('pages.adminOverview.statusHealthy')}
              {data.status === 'warning' && t('pages.adminOverview.statusWarning')}
              {data.status === 'unhealthy' && t('pages.adminOverview.statusUnhealthy')}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('pages.adminOverview.checkedAt', {
                time: new Date(data.timestamp).toLocaleString(i18n.language),
              })}
            </p>
          </div>
        </div>
      )}

      {/* Service cards grid */}
      <div className="gap-md grid sm:grid-cols-2 lg:grid-cols-3">
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
          icon={Archive}
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
          icon={HardDrive}
          check={data?.checks.disk}
          loading={isLoading}
        />
      </div>
    </PageContainer>
  );
}
