import {
  ExclamationTriangleIcon as AlertTriangle,
  CheckCircleIcon as CheckCircle2,
  ArrowPathIcon as RefreshCw,
  ArrowUturnLeftIcon as RotateCcw,
  PaperAirplaneIcon as Send,
  XCircleIcon as XCircle,
} from '@heroicons/react/24/solid';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { adminService } from '@/services/admin-service';
import { useAuthStore } from '@/stores/auth-store';
import type { ServiceCheck, ServiceStatus } from '@/types';

const statusConfig: Record<
  ServiceStatus,
  { icon: React.ElementType; color: string; bg: string; statusKey: string }
> = {
  healthy: {
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10 border-green-500/30',
    statusKey: 'healthy',
  },
  unhealthy: {
    icon: XCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10 border-destructive/30',
    statusKey: 'unhealthy',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    statusKey: 'warning',
  },
  not_configured: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    bg: 'bg-secondary border-border',
    statusKey: 'not_configured',
  },
  unknown: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    bg: 'bg-secondary border-border',
    statusKey: 'unknown',
  },
  not_active: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    bg: 'bg-secondary border-border',
    statusKey: 'not_active',
  },
};

interface IntegrationCardProps {
  name: string;
  icon: React.ElementType;
  check: ServiceCheck | undefined;
  loading: boolean;
  details?: React.ReactNode;
}

export function IntegrationCard({
  name,
  icon: Icon,
  check,
  loading,
  details,
}: IntegrationCardProps) {
  const { t } = useTranslation();
  const s = check?.status ?? 'unknown';
  const cfg = statusConfig[s] ?? statusConfig.unknown;
  const StatusIcon = cfg.icon;

  return (
    <div className={cn('bg-card rounded-lg border p-5', cfg.bg)}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-card flex h-10 w-10 items-center justify-center rounded-lg shadow-sm">
            <Icon className="text-foreground h-5 w-5" />
          </div>
          <div>
            <p className="text-foreground font-semibold">{name}</p>
            {loading ? (
              <p className="text-muted-foreground text-xs">
                {t('pages.adminIntegrations.checking')}
              </p>
            ) : (
              <p
                className={cn(
                  'gap-xs flex items-center text-xs font-medium',
                  cfg.color
                )}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {t(`pages.adminIntegrations.status.${cfg.statusKey}`)}
              </p>
            )}
          </div>
        </div>
        {loading && (
          <RefreshCw className="text-muted-foreground h-4 w-4 animate-spin" />
        )}
      </div>
      {check?.message && (
        <p className="mb-sm text-muted-foreground text-sm">{check.message}</p>
      )}
      {check?.models && check.models.length > 0 && (
        <div className="gap-xs flex flex-wrap">
          {check.models.map((m) => (
            <span
              key={m}
              className="bg-card px-sm text-foreground rounded-full py-0.5 font-mono text-xs shadow-sm"
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

export function OllamaRestartPanel() {
  const { t } = useTranslation();
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
          title: t('pages.adminIntegrations.restartError'),
          description: details || data.message,
          variant: 'destructive',
        });
        return;
      }
      setRedirecting(true);
      toast({
        title: t('pages.adminIntegrations.restartingToast'),
        description: t('pages.adminIntegrations.restartingDesc'),
      });
      setTimeout(() => {
        logout();
        void navigate('/login');
      }, 2500);
    },
    onError: (err: Error) => {
      toast({
        title: t('pages.adminIntegrations.restartError'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="border-border mt-3 border-t pt-3">
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || redirecting}
        className="gap-xs border-border bg-card py-sm text-foreground hover:bg-accent flex items-center rounded-lg border px-3 text-sm font-medium disabled:opacity-50"
      >
        {mutation.isPending || redirecting ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" />
        )}
        {redirecting
          ? t('pages.adminIntegrations.disconnecting')
          : t('pages.adminIntegrations.restartAllBtn')}
      </button>
    </div>
  );
}

export function EmailTestPanel() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (to: string) => adminService.sendTestEmail(to),
    onSuccess: (data) => {
      toast({
        title: t('pages.adminIntegrations.emailSent'),
        description: data.message,
      });
      setEmail('');
    },
    onError: (err: Error) => {
      toast({
        title: t('pages.adminIntegrations.emailError'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="border-border mt-3 border-t pt-3">
      <p className="mb-sm text-foreground text-sm font-medium">
        {t('pages.adminIntegrations.sendTestEmail')}
      </p>
      <div className="gap-sm flex">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('pages.adminIntegrations.emailPlaceholder')}
          className="border-border bg-background py-sm text-foreground focus:ring-primary flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
          onKeyDown={(e) => e.key === 'Enter' && email && mutation.mutate(email)}
        />
        <button
          onClick={() => email && mutation.mutate(email)}
          disabled={!email || mutation.isPending}
          className="gap-xs bg-primary py-sm text-primary-foreground hover:bg-primary/90 flex items-center rounded-lg px-3 text-sm font-medium disabled:opacity-50"
        >
          {mutation.isPending ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {t('pages.adminIntegrations.sendBtn')}
        </button>
      </div>
    </div>
  );
}
