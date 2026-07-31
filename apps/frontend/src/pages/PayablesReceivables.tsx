import { Receipt, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import Payables from './Payables';
import Receivables from './Receivables';

const TAB_KEY = 'payablesReceivables.activeTab';

export default function PayablesReceivables() {
  const { t } = useTranslation();

  const defaultTab = localStorage.getItem(TAB_KEY) ?? 'payables';

  const handleTabChange = (value: string) => {
    localStorage.setItem(TAB_KEY, value);
  };

  return (
    <AnimatedPage className="px-sm py-md md:px-lg md:py-xl flex flex-col">
      <Tabs
        defaultValue={defaultTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col"
      >
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
          <Payables embedded />
        </TabsContent>

        <TabsContent value="receivables" className="mt-0 flex-1">
          <Receivables embedded />
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
}
