import { TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    <AnimatedPage className="flex flex-col px-sm py-md md:px-lg md:py-xl">
      <Tabs
        defaultValue={defaultTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="expenses" className="flex-1 gap-xs">
            <TrendingDown className="h-4 w-4" />
            {t('pages.expenses.title')}
          </TabsTrigger>
          <TabsTrigger value="revenues" className="flex-1 gap-xs">
            <TrendingUp className="h-4 w-4" />
            {t('pages.revenues.title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-0 flex-1">
          <Expenses embedded />
        </TabsContent>

        <TabsContent value="revenues" className="mt-0 flex-1">
          <Revenues embedded />
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
}
