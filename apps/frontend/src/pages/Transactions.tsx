import {
  CreditCardIcon as CreditCard,
  ArrowTrendingDownIcon as TrendingDown,
  ArrowTrendingUpIcon as TrendingUp,
} from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import CreditCardExpenses from './CreditCardExpenses';
import Expenses from './Expenses';
import Revenues from './Revenues';

const TAB_KEY = 'transactions.activeTab';

export default function Transactions() {
  const { t } = useTranslation();

  const defaultTab = localStorage.getItem(TAB_KEY) ?? 'expenses';

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
          <TabsTrigger value="expenses" className="gap-xs flex-1">
            <TrendingDown className="h-4 w-4" />
            {t('pages.expenses.title')}
          </TabsTrigger>
          <TabsTrigger value="revenues" className="gap-xs flex-1">
            <TrendingUp className="h-4 w-4" />
            {t('pages.revenues.title')}
          </TabsTrigger>
          <TabsTrigger value="credit-card" className="gap-xs flex-1">
            <CreditCard className="h-4 w-4" />
            {t('nav.items.creditCardExpenses')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-0 flex-1">
          <Expenses embedded />
        </TabsContent>

        <TabsContent value="revenues" className="mt-0 flex-1">
          <Revenues embedded />
        </TabsContent>

        <TabsContent value="credit-card" className="mt-0 flex-1">
          <CreditCardExpenses embedded />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
