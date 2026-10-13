import { BarChart3, GitCompareArrows } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTabRoute } from '@/hooks/use-tab-route';

import MonthComparison from './MonthComparison';
import SpendingInsights from './SpendingInsights';

const TABS = ['spending-insights', 'month-comparison'] as const;

export default function FinanceAnalyticsPage() {
  const { t } = useTranslation();
  // Cada aba renderiza seu cabeçalho (título + ações) aqui, acima das abas.
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useTabRoute(
    '/finance/analytics',
    TABS,
    'spending-insights'
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
          <TabsTrigger value="spending-insights" className="gap-xs flex-1">
            <BarChart3 className="h-4 w-4" />
            {t('nav.items.spendingInsights')}
          </TabsTrigger>
          <TabsTrigger value="month-comparison" className="gap-xs flex-1">
            <GitCompareArrows className="h-4 w-4" />
            {t('nav.items.monthComparison')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="spending-insights" className="mt-0 flex-1">
          <SpendingInsights embedded headerTarget={headerTarget} />
        </TabsContent>

        <TabsContent value="month-comparison" className="mt-0 flex-1">
          <MonthComparison embedded headerTarget={headerTarget} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
