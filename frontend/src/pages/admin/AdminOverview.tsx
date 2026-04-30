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

import { cn } from '@/lib/utils';
import { adminService } from '@/services/admin-service';
import type { ServiceCheck, ServiceStatus } from '@/types';

const statusConfig: Record<
  ServiceStatus,
  { icon: React.ElementType; color: string; label: string }
> = {
  healthy: { icon: CheckCircle2, color: 'text-green-500', label: 'Operacional' },
  unhealthy: { icon: XCircle, color: 'text-destructive', label: 'Com problema' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', label: 'Atenção' },
  not_configured: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    label: 'Não configurado',
  },
  unknown: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    label: 'Desconhecido',
  },
  not_active: { icon: AlertTriangle, color: 'text-muted-foreground', label: 'Inativo' },
};

interface ServiceCardProps {
  name: string;
  icon: React.ElementType;
  check: ServiceCheck | undefined;
  loading: boolean;
}

function ServiceCard({ name, icon: Icon, check, loading }: ServiceCardProps) {
  const s = check?.status ?? 'unknown';
  const cfg = statusConfig[s] ?? statusConfig.unknown;
  const StatusIcon = cfg.icon;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
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
      <p className={cn('text-sm font-medium', cfg.color)}>{cfg.label}</p>
      {check?.message && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {check.message}
        </p>
      )}
      {check?.free_percent !== undefined && (
        <div className="mt-2">
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
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: () => adminService.getHealth(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR')
    : null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Visão Geral do Sistema</h1>
          <p className="text-sm text-muted-foreground">
            Status em tempo real de todos os serviços
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              Atualizado às {lastUpdate}
            </span>
          )}
          <button
            onClick={() => void refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Overall status banner */}
      {data && (
        <div
          className={cn(
            'mb-6 flex items-center gap-3 rounded-xl border px-5 py-4',
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
              {data.status === 'healthy' && 'Todos os serviços operacionais'}
              {data.status === 'warning' && 'Sistema operacional com avisos'}
              {data.status === 'unhealthy' && 'Atenção: serviços com problema'}
            </p>
            <p className="text-sm text-muted-foreground">
              Verificado em {new Date(data.timestamp).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      )}

      {/* Service cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ServiceCard
          name="Banco de Dados"
          icon={Database}
          check={data?.checks.database}
          loading={isLoading}
        />
        <ServiceCard
          name="Cache (Redis)"
          icon={Zap}
          check={data?.checks.cache}
          loading={isLoading}
        />
        <ServiceCard
          name="Armazenamento (MinIO)"
          icon={HardDrive}
          check={data?.checks.storage}
          loading={isLoading}
        />
        <ServiceCard
          name="LLM (Ollama)"
          icon={Server}
          check={data?.checks.ollama}
          loading={isLoading}
        />
        <ServiceCard
          name="Email (SMTP)"
          icon={Mail}
          check={data?.checks.email}
          loading={isLoading}
        />
        <ServiceCard
          name="Disco"
          icon={Wifi}
          check={data?.checks.disk}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
