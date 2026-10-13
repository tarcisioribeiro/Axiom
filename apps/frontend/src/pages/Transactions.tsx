import { PageContainer } from '@/components/common/PageContainer';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useTabRoute } from '@/hooks/use-tab-route';

import CreditCardExpenses from './CreditCardExpenses';
import Expenses from './Expenses';
import Revenues from './Revenues';

const TABS = ['expenses', 'revenues', 'credit-card-expenses'] as const;

export default function Transactions() {
  const [activeTab, setActiveTab] = useTabRoute('/transactions', TABS, 'expenses');

  return (
    <PageContainer className="flex flex-1 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as (typeof TABS)[number])}
        className="flex flex-1 flex-col"
      >
        <TabsContent value="expenses" className="mt-0 flex-1">
          <Expenses embedded />
        </TabsContent>

        <TabsContent value="revenues" className="mt-0 flex-1">
          <Revenues embedded />
        </TabsContent>

        <TabsContent value="credit-card-expenses" className="mt-0 flex-1">
          <CreditCardExpenses embedded />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
