import {
  BuildingLibraryIcon as Landmark,
  ArrowTrendingUpIcon as TrendingUp,
} from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import DebtPayoffPlanner from './DebtPayoffPlanner';
import NetWorthTracker from './NetWorthTracker';

const TAB_KEY = 'financialHealth.activeTab';

export default function FinancialHealthPage() {
  const { t } = useTranslation();

  const defaultTab = localStorage.getItem(TAB_KEY) ?? 'net-worth';

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
          <TabsTrigger value="net-worth" className="gap-xs flex-1">
            <TrendingUp className="h-4 w-4" />
            {t('nav.items.netWorth')}
          </TabsTrigger>
          <TabsTrigger value="debt-payoff" className="gap-xs flex-1">
            <Landmark className="h-4 w-4" />
            {t('nav.items.debtPayoff')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="net-worth" className="mt-0 flex-1">
          <NetWorthTracker embedded />
        </TabsContent>

        <TabsContent value="debt-payoff" className="mt-0 flex-1">
          <DebtPayoffPlanner embedded />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
