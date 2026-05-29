import { CreditCard, Receipt, ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import CreditCardBills from './CreditCardBills';
import CreditCardExpenses from './CreditCardExpenses';
import CreditCards from './CreditCards';

const TAB_KEY = 'creditCardManagement.activeTab';

export default function CreditCardManagement() {
  const { t } = useTranslation();

  const defaultTab = localStorage.getItem(TAB_KEY) ?? 'cards';

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
          <TabsTrigger value="cards" className="flex-1 gap-xs">
            <CreditCard className="h-4 w-4" />
            {t('pages.creditCards.title')}
          </TabsTrigger>
          <TabsTrigger value="bills" className="flex-1 gap-xs">
            <Receipt className="h-4 w-4" />
            {t('pages.creditCardBills.title')}
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex-1 gap-xs">
            <ShoppingCart className="h-4 w-4" />
            {t('pages.creditCardExpenses.title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="mt-0 flex-1">
          <CreditCards embedded />
        </TabsContent>
        <TabsContent value="bills" className="mt-0 flex-1">
          <CreditCardBills embedded />
        </TabsContent>
        <TabsContent value="expenses" className="mt-0 flex-1">
          <CreditCardExpenses embedded />
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
}
