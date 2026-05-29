import { CheckCircle2, Calendar, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import Goals from './Goals';
import RoutineTasks from './RoutineTasks';
import TodayTasks from './TodayTasks';

const TAB_KEY = 'tasksGoals.activeTab';

export default function TasksAndGoals() {
  const { t } = useTranslation();

  const defaultTab = localStorage.getItem(TAB_KEY) ?? 'today';

  const handleTabChange = (value: string) => {
    localStorage.setItem(TAB_KEY, value);
  };

  return (
    <AnimatedPage className="flex flex-col px-sm py-md md:px-lg md:py-xl">
      <Tabs
        defaultValue={defaultTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="today" className="flex-1 gap-xs">
            <CheckCircle2 className="h-4 w-4" />
            {t('pages.todayTasks.title')}
          </TabsTrigger>
          <TabsTrigger value="routine" className="flex-1 gap-xs">
            <Calendar className="h-4 w-4" />
            {t('pages.routineTasks.title')}
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex-1 gap-xs">
            <Trophy className="h-4 w-4" />
            {t('pages.goals.title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-0 flex-1">
          <TodayTasks embedded />
        </TabsContent>

        <TabsContent value="routine" className="mt-0 flex-1">
          <RoutineTasks embedded />
        </TabsContent>

        <TabsContent value="goals" className="mt-0 flex-1">
          <Goals embedded />
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
}
