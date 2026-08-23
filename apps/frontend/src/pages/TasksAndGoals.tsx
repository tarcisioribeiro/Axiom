import {
  CheckCircleIcon as CheckCircle2,
  CalendarIcon as Calendar,
  TrophyIcon as Trophy,
} from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import DailyChecklist from './DailyChecklist';
import Goals from './Goals';
import RoutineTasks from './RoutineTasks';

const TAB_KEY = 'tasksGoals.activeTab';

export default function TasksAndGoals() {
  const { t } = useTranslation();

  const defaultTab = localStorage.getItem(TAB_KEY) ?? 'daily';

  const handleTabChange = (value: string) => {
    localStorage.setItem(TAB_KEY, value);
  };

  return (
    <PageContainer className="flex flex-1 flex-col">
      <Tabs
        defaultValue={defaultTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col"
      >
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
          <DailyChecklist embedded />
        </TabsContent>

        <TabsContent value="routine" className="mt-0 flex-1">
          <RoutineTasks embedded />
        </TabsContent>

        <TabsContent value="goals" className="mt-0 flex-1">
          <Goals embedded />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
