import { BarChart3, GitCompareArrows } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import MonthComparison from './MonthComparison';
import SpendingInsights from './SpendingInsights';

const TAB_KEY = 'financeAnalytics.activeTab';

export default function FinanceAnalyticsPage() {
  const { t } = useTranslation();

  const defaultTab = localStorage.getItem(TAB_KEY) ?? 'insights';

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
          <TabsTrigger value="insights" className="flex-1 gap-xs">
            <BarChart3 className="h-4 w-4" />
            {t('nav.items.spendingInsights')}
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex-1 gap-xs">
            <GitCompareArrows className="h-4 w-4" />
            {t('nav.items.monthComparison')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="mt-0 flex-1">
          <SpendingInsights embedded />
        </TabsContent>

        <TabsContent value="comparison" className="mt-0 flex-1">
          <MonthComparison embedded />
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
}
