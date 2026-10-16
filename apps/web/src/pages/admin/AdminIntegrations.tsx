import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  Database,
  HardDrive,
  Link2,
  Mail,
  RefreshCw,
  RotateCcw,
  Send,
  Server,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { adminService } from '@/services/admin-service';

import { RestartModal } from './AdminConfigRestartModal';
import {
  EmailTestDialog,
  IntegrationCard,
  IntegrationDetailDialog,
} from './IntegrationCard';

export default function AdminIntegrations() {
  const { t } = useTranslation();
  const [detailKey, setDetailKey] = useState<string>();
  const [emailOpen, setEmailOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: () => adminService.getIntegrations(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const services = [
    { key: 'database', icon: Database, check: data?.database },
    { key: 'cache', icon: Zap, check: data?.cache },
    { key: 'storage', icon: HardDrive, check: data?.storage },
    { key: 'ollama', icon: Server, check: data?.ollama },
    { key: 'anthropic', icon: Bot, check: data?.anthropic },
    { key: 'email', icon: Mail, check: data?.email },
  ].map((svc) => ({ ...svc, name: t(`pages.adminIntegrations.services.${svc.key}`) }));

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.adminIntegrations.title')}
        icon={<Link2 />}
        actions={
          <Button variant="outline" onClick={() => void refetch()} loading={isFetching}>
            {!isFetching && <RefreshCw />}
            {t('pages.adminIntegrations.testAll')}
          </Button>
        }
      />

      {/* LLM provider info */}
      {data && (
        <div className="border-border bg-card px-md rounded-lg border py-3">
          <div className="gap-md flex flex-wrap items-center text-sm">
            <span className="text-muted-foreground">
              {t('pages.adminIntegrations.activeProvider')}
            </span>
            <span className="text-foreground font-semibold uppercase">
              {data.llm_provider}
            </span>
            {data.llm_provider === 'ollama' && data.ollama_model && (
              <>
                <span className="text-muted-foreground">
                  {t('pages.adminIntegrations.model')}
                </span>
                <span className="text-foreground">{data.ollama_model}</span>
              </>
            )}
            {data.llm_provider === 'anthropic' && data.anthropic_model && (
              <>
                <span className="text-muted-foreground">
                  {t('pages.adminIntegrations.model')}
                </span>
                <span className="text-foreground">{data.anthropic_model}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Problemas de configuração do sistema de agentes */}
      {data && data.llm_warnings.length > 0 && (
        <div className="gap-sm px-md py-sm flex items-start rounded-lg border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.1)] text-sm text-[hsl(var(--warning))]">
          <AlertTriangle className="mt-xs h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">{t('pages.adminIntegrations.llmWarnings')}</p>
            <ul className="pl-md list-disc">
              {data.llm_warnings.map((w) => {
                const text = t(`pages.adminIntegrations.llmIssues.${w.code}`, {
                  ...w,
                  reason:
                    w.reason && t(`pages.adminIntegrations.llmReasons.${w.reason}`),
                });
                const scope =
                  w.role && t(`pages.adminIntegrations.llmRoles.${w.role}`, w);
                return (
                  <li key={JSON.stringify(w)}>{scope ? `${scope}: ${text}` : text}</li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <div className="gap-md grid md:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => (
          <IntegrationCard
            key={svc.key}
            name={svc.name}
            icon={svc.icon}
            check={svc.check}
            loading={isLoading}
            onOpen={() => setDetailKey(svc.key)}
            actions={
              svc.key === 'ollama' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRestartOpen(true);
                  }}
                  aria-label={t('pages.adminIntegrations.restartAllBtn')}
                >
                  <RotateCcw
                    className="text-muted-foreground h-4 w-4"
                    aria-hidden="true"
                  />
                </Button>
              ) : svc.key === 'email' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEmailOpen(true);
                  }}
                  aria-label={t('pages.adminIntegrations.sendTestEmail')}
                >
                  <Send className="text-primary h-4 w-4" aria-hidden="true" />
                </Button>
              ) : undefined
            }
          />
        ))}
      </div>

      <IntegrationDetailDialog
        item={services.find((svc) => svc.key === detailKey)}
        onClose={() => setDetailKey(undefined)}
      />
      <EmailTestDialog open={emailOpen} onClose={() => setEmailOpen(false)} />
      <RestartModal open={restartOpen} onClose={() => setRestartOpen(false)} />
    </PageContainer>
  );
}
