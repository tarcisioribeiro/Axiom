import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Database, HardDrive, Mail, RefreshCw, Server, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    <div>
      <div className="mb-lg flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('pages.adminIntegrations.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('pages.adminIntegrations.subtitle')}
          </p>
        </div>
        <button
          onClick={() => {
            void refetch();
            void queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] });
          }}
          disabled={isLoading}
          className="flex items-center gap-sm rounded-lg border border-border bg-card px-3 py-sm text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          {t('pages.adminIntegrations.testAll')}
        </button>
      </div>

      {/* LLM provider info */}
      {data && (
        <div className="mb-md rounded-lg border border-border bg-card px-md py-3">
          <div className="flex flex-wrap items-center gap-md text-sm">
            <span className="text-muted-foreground">
              {t('pages.adminIntegrations.activeProvider')}
            </span>
            <span className="font-semibold uppercase text-foreground">
              {data.llm_provider}
            </span>
            {data.llm_provider === 'ollama' && data.ollama_model && (
              <>
                <span className="text-muted-foreground">
                  {t('pages.adminIntegrations.model')}
                </span>
                <span className="font-mono text-foreground">{data.ollama_model}</span>
              </>
            )}
            {data.llm_provider === 'anthropic' && data.anthropic_model && (
              <>
                <span className="text-muted-foreground">
                  {t('pages.adminIntegrations.model')}
                </span>
                <span className="font-mono text-foreground">
                  {data.anthropic_model}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-md md:grid-cols-2">
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
    </div>
  );
}
