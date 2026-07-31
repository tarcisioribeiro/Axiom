import { CalendarClock, RefreshCcw, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import FixedExpenses from './FixedExpenses';
import FixedRevenues from './FixedRevenues';
import SubscriptionTracker from './SubscriptionTracker';

const TAB_KEY = 'recurringItems.activeTab';

export default function RecurringItems() {
  const { t } = useTranslation();

  const defaultTab = localStorage.getItem(TAB_KEY) ?? 'fixed-expenses';

  const handleTabChange = (value: string) => {
    localStorage.setItem(TAB_KEY, value);
  };

  return (
    <AnimatedPage className="px-sm py-md md:px-lg md:py-xl flex flex-col">
      <Tabs
        defaultValue={defaultTab}
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
          <TabsTrigger value="subscriptions" className="gap-xs flex-1">
            <RefreshCcw className="h-4 w-4" />
            {t('nav.items.subscriptions')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fixed-expenses" className="mt-0 flex-1">
          <FixedExpenses embedded />
        </TabsContent>

        <TabsContent value="fixed-revenues" className="mt-0 flex-1">
          <FixedRevenues embedded />
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-0 flex-1">
          <SubscriptionTracker embedded />
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
}
