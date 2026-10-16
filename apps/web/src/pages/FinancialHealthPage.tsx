import { Landmark, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTabRoute } from '@/hooks/use-tab-route';

import DebtPayoffPlanner from './DebtPayoffPlanner';
import NetWorthTracker from './NetWorthTracker';

const TABS = ['net-worth', 'debt-payoff'] as const;

export default function FinancialHealthPage() {
  const { t } = useTranslation();
  // Cada aba renderiza seu cabeçalho (título + ações) aqui, acima das abas.
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useTabRoute(
    '/finance/financial-health',
    TABS,
    'net-worth'
  );

  return (
    <PageContainer className="flex flex-1 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as (typeof TABS)[number])}
        className="flex flex-1 flex-col"
      >
        <div ref={setHeaderTarget} className="mb-lg empty:hidden" />
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
          <NetWorthTracker embedded headerTarget={headerTarget} />
        </TabsContent>

        <TabsContent value="debt-payoff" className="mt-0 flex-1">
          <DebtPayoffPlanner embedded headerTarget={headerTarget} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
