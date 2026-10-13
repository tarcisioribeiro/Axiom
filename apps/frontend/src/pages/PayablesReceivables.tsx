import { Receipt, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTabRoute } from '@/hooks/use-tab-route';

import Payables from './Payables';
import Receivables from './Receivables';

const TABS = ['payables', 'receivables'] as const;

export default function PayablesReceivables() {
  const { t } = useTranslation();
  // Cada aba renderiza seu cabeçalho (título + ações) aqui, acima das abas.
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useTabRoute('/bills', TABS, 'payables');

  return (
    <PageContainer className="flex flex-1 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as (typeof TABS)[number])}
        className="flex flex-1 flex-col"
      >
        <div ref={setHeaderTarget} className="mb-lg empty:hidden" />
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="payables" className="gap-xs flex-1">
            <Receipt className="h-4 w-4" />
            {t('pages.payables.title')}
          </TabsTrigger>
          <TabsTrigger value="receivables" className="gap-xs flex-1">
            <TrendingUp className="h-4 w-4" />
            {t('pages.receivables.title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payables" className="mt-0 flex-1">
          <Payables embedded headerTarget={headerTarget} />
        </TabsContent>

        <TabsContent value="receivables" className="mt-0 flex-1">
          <Receivables embedded headerTarget={headerTarget} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
