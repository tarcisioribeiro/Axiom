import { Calendar, CalendarClock, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import FixedExpenses from './FixedExpenses';
import FixedRevenues from './FixedRevenues';

const TAB_KEY = 'recurringItems.activeTab';
const VALID_TABS = new Set(['fixed-expenses', 'fixed-revenues']);

export default function RecurringItems() {
  const { t } = useTranslation();

  // Guarda contra valor obsoleto no localStorage (ex.: a antiga aba "subscriptions").
  const storedTab = localStorage.getItem(TAB_KEY);
  const defaultTab = storedTab && VALID_TABS.has(storedTab) ? storedTab : 'fixed-expenses';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const newExpenseRef = useRef<() => void>(undefined);
  const launchExpensesRef = useRef<() => void>(undefined);
  const newRevenueRef = useRef<() => void>(undefined);
  const launchRevenuesRef = useRef<() => void>(undefined);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem(TAB_KEY, value);
  };

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
        onValueChange={handleTabChange}
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
