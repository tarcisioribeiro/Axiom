import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RotateCcw, Settings } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { adminService } from '@/services/admin-service';
import type { ConfigCategory, SystemConfig } from '@/types';

import { RestartModal } from './AdminConfigRestartModal';
import { CategorySection } from './AdminConfigRow';

const CATEGORY_ORDER: ConfigCategory[] = [
  'llm',
  'email',
  'backup',
  'app',
  'security',
  'storage',
];

export default function AdminConfig() {
  const { t } = useTranslation();
  const [restartOpen, setRestartOpen] = useState(false);

  const { data: configs, isLoading } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: () => adminService.getConfigs(),
    staleTime: 60_000,
  });

  const grouped = CATEGORY_ORDER.reduce<Record<ConfigCategory, SystemConfig[]>>(
    (acc, cat) => {
      acc[cat] = (configs ?? []).filter((c) => c.category === cat);
      return acc;
    },
    { llm: [], email: [], backup: [], app: [], security: [], storage: [] }
  );

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-md">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card h-32 animate-pulse rounded-lg" />
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.adminConfig.title')}
        subtitle={t('pages.adminConfig.subtitle')}
        icon={<Settings />}
        actions={
          <Button
            variant="outline"
            onClick={() => setRestartOpen(true)}
            className="gap-sm flex-shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            {t('pages.adminConfig.restartBtn')}
          </Button>
        }
      />

      <div className="px-md flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 py-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {t('pages.adminConfig.restartWarning')}
        </p>
      </div>

      {CATEGORY_ORDER.map((cat) =>
        grouped[cat].length > 0 ? (
          <CategorySection key={cat} category={cat} configs={grouped[cat]} />
        ) : null
      )}

      <RestartModal open={restartOpen} onClose={() => setRestartOpen(false)} />
    </PageContainer>
  );
}
