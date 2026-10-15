import { useQuery } from '@tanstack/react-query';
import {
  AppWindow,
  Bot,
  DatabaseBackup,
  HardDrive,
  Mail,
  RotateCcw,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { Button } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { adminService } from '@/services/admin-service';
import type { ConfigCategory, SystemConfig } from '@/types';

import { RestartModal } from './AdminConfigRestartModal';
import { ConfigEditDialog, ConfigRevealDialog, ConfigRow } from './AdminConfigRow';

const CATEGORIES: { key: ConfigCategory; icon: React.ElementType }[] = [
  { key: 'llm', icon: Bot },
  { key: 'email', icon: Mail },
  { key: 'backup', icon: DatabaseBackup },
  { key: 'app', icon: AppWindow },
  { key: 'security', icon: ShieldCheck },
  { key: 'storage', icon: HardDrive },
];

export default function AdminConfig() {
  const { t } = useTranslation();
  const [restartOpen, setRestartOpen] = useState(false);
  const [editing, setEditing] = useState<SystemConfig>();
  const [revealing, setRevealing] = useState<SystemConfig>();
  // Accordion (§5): a primeira categoria aberta, uma por vez.
  const [openCat, setOpenCat] = useState<ConfigCategory | null>('llm');

  const { data: configs, isLoading } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: () => adminService.getConfigs(),
    staleTime: 60_000,
  });

  const sections = CATEGORIES.map((c) => ({
    ...c,
    configs: (configs ?? []).filter((cfg) => cfg.category === c.key),
  })).filter((c) => c.configs.length > 0);

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.adminConfig.title')}
        icon={<Settings />}
        actions={
          <Button variant="outline" onClick={() => setRestartOpen(true)}>
            <RotateCcw className="h-4 w-4" />
            {t('pages.adminConfig.restartBtn')}
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState skeleton="list" />
      ) : (
        <div className="space-y-sm">
          {sections.map(({ key, icon: Icon, configs: items }) => (
            <CollapsibleSection
              key={key}
              title={`${t(`pages.adminConfig.categories.${key}`)} (${items.length})`}
              icon={<Icon className="h-4 w-4" />}
              open={openCat === key}
              onToggle={() => setOpenCat((c) => (c === key ? null : key))}
            >
              <PaginatedSlide items={items} pageSize={LIST_PAGE_SIZE} pinNav={false}>
                {(pageItems) =>
                  pageItems.map((cfg) => (
                    <ConfigRow
                      key={cfg.key}
                      config={cfg}
                      onEdit={setEditing}
                      onReveal={setRevealing}
                    />
                  ))
                }
              </PaginatedSlide>
            </CollapsibleSection>
          ))}
        </div>
      )}

      <ConfigEditDialog config={editing} onClose={() => setEditing(undefined)} />
      <ConfigRevealDialog config={revealing} onClose={() => setRevealing(undefined)} />
      <RestartModal open={restartOpen} onClose={() => setRestartOpen(false)} />
    </PageContainer>
  );
}
