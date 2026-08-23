import {
  ChartBarSquareIcon as BarChart3,
  ArrowsRightLeftIcon as GitCompareArrows,
} from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
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
    <PageContainer className="flex flex-1 flex-col">
      <Tabs
        defaultValue={defaultTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="insights" className="gap-xs flex-1">
            <BarChart3 className="h-4 w-4" />
            {t('nav.items.spendingInsights')}
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-xs flex-1">
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
    </PageContainer>
  );
}
