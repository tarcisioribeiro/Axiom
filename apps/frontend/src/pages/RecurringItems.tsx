import { Calendar, CalendarClock, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTabRoute } from '@/hooks/use-tab-route';

import FixedExpenses from './FixedExpenses';
import FixedRevenues from './FixedRevenues';

const TABS = ['fixed-expenses', 'fixed-revenues'] as const;

export default function RecurringItems() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useTabRoute('/recurring', TABS, 'fixed-expenses');

  const newExpenseRef = useRef<() => void>(undefined);
  const launchExpensesRef = useRef<() => void>(undefined);
  const newRevenueRef = useRef<() => void>(undefined);
  const launchRevenuesRef = useRef<() => void>(undefined);

  return (
    <PageContainer className="flex flex-1 flex-col">
      {activeTab === 'fixed-expenses' && (
        <PageHeader
          title={t('pages.fixedExpenses.title')}
          icon={<CalendarClock className="h-6 w-6" />}
          actions={
            <Button variant="outline" onClick={() => launchExpensesRef.current?.()}>
              <TrendingDown className="h-4 w-4" />
              {t('pages.fixedExpenses.launchBtn')}
            </Button>
          }
          action={{
            label: t('pages.fixedExpenses.newBtn'),
            icon: <Plus className="h-4 w-4" />,
            onClick: () => newExpenseRef.current?.(),
          }}
        />
      )}

      {activeTab === 'fixed-revenues' && (
        <PageHeader
          title={t('pages.fixedRevenues.title')}
          icon={<Calendar className="h-6 w-6" />}
          actions={
            <Button variant="outline" onClick={() => launchRevenuesRef.current?.()}>
              <TrendingUp className="h-4 w-4" />
              {t('pages.fixedRevenues.launchBtn')}
            </Button>
          }
          action={{
            label: t('pages.fixedRevenues.newBtn'),
            icon: <Plus className="h-4 w-4" />,
            onClick: () => newRevenueRef.current?.(),
          }}
        />
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as (typeof TABS)[number])}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="fixed-expenses" className="gap-xs flex-1">
            <CalendarClock className="h-4 w-4" />
            {t('pages.fixedExpenses.title')}
          </TabsTrigger>
          <TabsTrigger value="fixed-revenues" className="gap-xs flex-1">
            <TrendingUp className="h-4 w-4" />
            {t('pages.fixedRevenues.title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fixed-expenses" className="mt-0 flex-1">
          <FixedExpenses
            embedded
            newExpenseRef={newExpenseRef}
            launchExpensesRef={launchExpensesRef}
          />
        </TabsContent>

        <TabsContent value="fixed-revenues" className="mt-0 flex-1">
          <FixedRevenues
            embedded
            newRevenueRef={newRevenueRef}
            launchRevenuesRef={launchRevenuesRef}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
