import { CheckCircle2, Calendar, Trophy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTabRoute } from '@/hooks/use-tab-route';

import DailyChecklist from './DailyChecklist';
import Goals from './Goals';
import RoutineTasks from './RoutineTasks';

const TABS = ['daily', 'routine', 'goals'] as const;

export default function TasksAndGoals() {
  const { t } = useTranslation();

  // Cada aba renderiza seu cabeçalho (título + ações) aqui, acima das abas.
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useTabRoute('/planning/tasks-goals', TABS, 'daily');

  return (
    <PageContainer className="flex flex-1 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as (typeof TABS)[number])}
        className="flex flex-1 flex-col"
      >
        <div ref={setHeaderTarget} className="mb-lg empty:hidden" />
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="daily" className="gap-xs flex-1">
            <CheckCircle2 className="h-4 w-4" />
            {t('pages.dailyChecklist.title')}
          </TabsTrigger>
          <TabsTrigger value="routine" className="gap-xs flex-1">
            <Calendar className="h-4 w-4" />
            {t('pages.routineTasks.title')}
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-xs flex-1">
            <Trophy className="h-4 w-4" />
            {t('pages.goals.title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-0 flex-1">
          <DailyChecklist embedded headerTarget={headerTarget} />
        </TabsContent>

        <TabsContent value="routine" className="mt-0 flex-1">
          <RoutineTasks embedded headerTarget={headerTarget} />
        </TabsContent>

        <TabsContent value="goals" className="mt-0 flex-1">
          <Goals embedded headerTarget={headerTarget} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
