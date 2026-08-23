import {
  CommandLineIcon as Bot,
  CircleStackIcon as Database,
  ServerStackIcon as HardDrive,
  LinkIcon as Link2,
  EnvelopeIcon as Mail,
  ArrowPathIcon as RefreshCw,
  ServerIcon as Server,
  BoltIcon as Zap,
} from '@heroicons/react/24/solid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { cn } from '@/lib/utils';
import { adminService } from '@/services/admin-service';

import { EmailTestPanel, IntegrationCard, OllamaRestartPanel } from './IntegrationCard';

export default function AdminIntegrations() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: () => adminService.getIntegrations(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.adminIntegrations.title')}
        subtitle={t('pages.adminIntegrations.subtitle')}
        icon={<Link2 />}
        actions={
          <button
            onClick={() => {
              void refetch();
              void queryClient.invalidateQueries({
                queryKey: ['admin', 'integrations'],
              });
            }}
            disabled={isLoading}
            className="gap-sm border-border bg-card py-sm text-foreground hover:bg-accent flex items-center rounded-lg border px-3 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            {t('pages.adminIntegrations.testAll')}
          </button>
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
                <span className="text-foreground font-mono">{data.ollama_model}</span>
              </>
            )}
            {data.llm_provider === 'anthropic' && data.anthropic_model && (
              <>
                <span className="text-muted-foreground">
                  {t('pages.adminIntegrations.model')}
                </span>
                <span className="text-foreground font-mono">
                  {data.anthropic_model}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="gap-md grid md:grid-cols-2">
        <IntegrationCard
          name={t('pages.adminIntegrations.services.database')}
          icon={Database}
          check={data?.database}
          loading={isLoading}
        />
        <IntegrationCard
          name={t('pages.adminIntegrations.services.cache')}
          icon={Zap}
          check={data?.cache}
          loading={isLoading}
        />
        <IntegrationCard
          name={t('pages.adminIntegrations.services.storage')}
          icon={HardDrive}
          check={data?.storage}
          loading={isLoading}
        />
        <IntegrationCard
          name={t('pages.adminIntegrations.services.ollama')}
          icon={Server}
          check={data?.ollama}
          loading={isLoading}
          details={<OllamaRestartPanel />}
        />
        <IntegrationCard
          name={t('pages.adminIntegrations.services.anthropic')}
          icon={Bot}
          check={data?.anthropic}
          loading={isLoading}
        />
        <IntegrationCard
          name={t('pages.adminIntegrations.services.email')}
          icon={Mail}
          check={data?.email}
          loading={isLoading}
          details={<EmailTestPanel />}
        />
      </div>
    </PageContainer>
  );
}
