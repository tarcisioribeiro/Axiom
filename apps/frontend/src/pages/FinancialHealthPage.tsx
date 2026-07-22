import { Landmark, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
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
    <AnimatedPage className="flex flex-col px-sm py-md md:px-lg md:py-xl">
      <Tabs
        defaultValue={defaultTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="net-worth" className="flex-1 gap-xs">
            <TrendingUp className="h-4 w-4" />
            {t('nav.items.netWorth')}
          </TabsTrigger>
          <TabsTrigger value="debt-payoff" className="flex-1 gap-xs">
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
    </AnimatedPage>
  );
}
