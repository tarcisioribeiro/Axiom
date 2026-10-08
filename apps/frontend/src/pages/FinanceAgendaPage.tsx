import { CalendarCheck, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTabRoute } from '@/hooks/use-tab-route';

import FinancialCalendar from './FinancialCalendar';
import MonthlyPlanner from './MonthlyPlanner';

const TABS = ['calendar', 'monthly-planner'] as const;

export default function FinanceAgendaPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useTabRoute('/finance/agenda', TABS, 'calendar');

  return (
    <PageContainer className="flex flex-1 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as (typeof TABS)[number])}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="calendar" className="gap-xs flex-1">
            <CalendarDays className="h-4 w-4" />
            {t('nav.items.financialCalendar')}
          </TabsTrigger>
          <TabsTrigger value="monthly-planner" className="gap-xs flex-1">
            <CalendarCheck className="h-4 w-4" />
            {t('nav.items.monthlyPlanner')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-0 flex-1">
          <FinancialCalendar embedded />
        </TabsContent>

        <TabsContent value="monthly-planner" className="mt-0 flex-1">
          <MonthlyPlanner embedded />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
