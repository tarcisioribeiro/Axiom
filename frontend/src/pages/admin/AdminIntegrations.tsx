import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  HardDrive,
  Mail,
  RefreshCw,
  RotateCcw,
  Send,
  Server,
  XCircle,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { adminService } from '@/services/admin-service';
import { useAuthStore } from '@/stores/auth-store';
import type { ServiceCheck, ServiceStatus } from '@/types';

const statusConfig: Record<
  ServiceStatus,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  healthy: {
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10 border-green-500/30',
    label: 'Operacional',
  },
  unhealthy: {
    icon: XCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10 border-destructive/30',
    label: 'Com problema',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    label: 'Atenção',
  },
  not_configured: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    bg: 'bg-secondary border-border',
    label: 'Não configurado',
  },
  unknown: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    bg: 'bg-secondary border-border',
    label: 'Desconhecido',
  },
  not_active: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    bg: 'bg-secondary border-border',
    label: 'Inativo',
  },
};

interface IntegrationCardProps {
  name: string;
  icon: React.ElementType;
  check: ServiceCheck | undefined;
  loading: boolean;
  details?: React.ReactNode;
}

function IntegrationCard({
  name,
  icon: Icon,
  check,
  loading,
  details,
}: IntegrationCardProps) {
  const s = check?.status ?? 'unknown';
  const cfg = statusConfig[s] ?? statusConfig.unknown;
  const StatusIcon = cfg.icon;

  return (
    <div className={cn('rounded-xl border bg-card p-5', cfg.bg)}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card shadow-sm">
            <Icon className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{name}</p>
            {loading ? (
              <p className="text-xs text-muted-foreground">Verificando...</p>
            ) : (
              <p
                className={cn('flex items-center gap-1 text-xs font-medium', cfg.color)}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {cfg.label}
              </p>
            )}
          </div>
        </div>
        {loading && (
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {check?.message && (
        <p className="mb-2 text-sm text-muted-foreground">{check.message}</p>
      )}
      {check?.models && check.models.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {check.models.map((m) => (
            <span
              key={m}
              className="rounded-full bg-card px-2 py-0.5 font-mono text-xs text-foreground shadow-sm"
            >
              {m}
            </span>
          ))}
        </div>
      )}
      {details}
    </div>
  );
}

function OllamaRestartPanel() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { toast } = useToast();
  const [redirecting, setRedirecting] = useState(false);

  const mutation = useMutation({
    mutationFn: () => adminService.restartAll(),
    onSuccess: (data) => {
      if (!data.success) {
        const details = Object.entries(data.results)
          .map(([pod, result]) => `${pod}: ${result}`)
          .join('\n');
        toast({
          title: 'Falha ao reiniciar',
          description: details || data.message,
          variant: 'destructive',
        });
        return;
      }
      setRedirecting(true);
      toast({
        title: 'Reiniciando todos os pods',
        description:
          'Você será desconectado. Aguarde os serviços subirem e faça login novamente.',
      });
      setTimeout(() => {
        logout();
        void navigate('/login');
      }, 2500);
    },
    onError: (err: Error) => {
      toast({
        title: 'Falha ao reiniciar',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || redirecting}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
      >
        {mutation.isPending || redirecting ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" />
        )}
        {redirecting ? 'Desconectando...' : 'Reiniciar todos os pods'}
      </button>
    </div>
  );
}

function EmailTestPanel() {
  const [email, setEmail] = useState('');
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (to: string) => adminService.sendTestEmail(to),
    onSuccess: (data) => {
      toast({ title: 'Email enviado', description: data.message });
      setEmail('');
    },
    onError: (err: Error) => {
      toast({
        title: 'Falha ao enviar',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 text-sm font-medium text-foreground">Enviar email de teste</p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="destinatario@exemplo.com"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          onKeyDown={(e) => e.key === 'Enter' && email && mutation.mutate(email)}
        />
        <button
          onClick={() => email && mutation.mutate(email)}
          disabled={!email || mutation.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Enviar
        </button>
      </div>
    </div>
  );
}

export default function AdminIntegrations() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: () => adminService.getIntegrations(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
          <p className="text-sm text-muted-foreground">
            Status em tempo real de todos os serviços externos
          </p>
        </div>
        <button
          onClick={() => {
            void refetch();
            void queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] });
          }}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Testar todas
        </button>
      </div>

      {/* LLM provider info */}
      {data && (
        <div className="mb-4 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-muted-foreground">Provedor ativo:</span>
            <span className="font-semibold uppercase text-foreground">
              {data.llm_provider}
            </span>
            {data.llm_provider === 'ollama' && data.ollama_model && (
              <>
                <span className="text-muted-foreground">Modelo:</span>
                <span className="font-mono text-foreground">{data.ollama_model}</span>
              </>
            )}
            {data.llm_provider === 'anthropic' && data.anthropic_model && (
              <>
                <span className="text-muted-foreground">Modelo:</span>
                <span className="font-mono text-foreground">
                  {data.anthropic_model}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <IntegrationCard
          name="Banco de Dados (PostgreSQL)"
          icon={Database}
          check={data?.database}
          loading={isLoading}
        />
        <IntegrationCard
          name="Cache (Redis)"
          icon={Zap}
          check={data?.cache}
          loading={isLoading}
        />
        <IntegrationCard
          name="Armazenamento (MinIO/S3)"
          icon={HardDrive}
          check={data?.storage}
          loading={isLoading}
        />
        <IntegrationCard
          name="LLM Local (Ollama)"
          icon={Server}
          check={data?.ollama}
          loading={isLoading}
          details={<OllamaRestartPanel />}
        />
        <IntegrationCard
          name="LLM Nuvem (Anthropic)"
          icon={Bot}
          check={data?.anthropic}
          loading={isLoading}
        />
        <IntegrationCard
          name="Email (SMTP)"
          icon={Mail}
          check={data?.email}
          loading={isLoading}
          details={<EmailTestPanel />}
        />
      </div>
    </div>
  );
}
