import { CreditCard, Receipt } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBreadcrumbExtraStore } from '@/stores/breadcrumb-extra-store';

import CreditCardBills from './CreditCardBills';
import CreditCards from './CreditCards';

const TAB_KEY = 'creditCardManagement.activeTab';

const TAB_LABEL_KEYS: Record<string, string> = {
  cards: 'pages.creditCards.title',
  bills: 'pages.creditCardBills.title',
};

export default function CreditCardManagement() {
  const { t } = useTranslation();
  const setExtraLabel = useBreadcrumbExtraStore((s) => s.setExtraLabel);

  const storedTab = localStorage.getItem(TAB_KEY);
  const defaultTab = storedTab === 'expenses' ? 'cards' : (storedTab ?? 'cards');

  useEffect(() => {
    setExtraLabel(t(TAB_LABEL_KEYS[defaultTab] ?? 'pages.creditCards.title'));
    return () => setExtraLabel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (value: string) => {
    localStorage.setItem(TAB_KEY, value);
    setExtraLabel(t(TAB_LABEL_KEYS[value] ?? 'pages.creditCards.title'));
  };

  return (
    <PageContainer className="flex flex-1 flex-col">
      <Tabs
        defaultValue={defaultTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="cards" className="gap-xs flex-1">
            <CreditCard className="h-4 w-4" />
            {t('pages.creditCards.title')}
          </TabsTrigger>
          <TabsTrigger value="bills" className="gap-xs flex-1">
            <Receipt className="h-4 w-4" />
            {t('pages.creditCardBills.title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="mt-0 flex-1">
          <CreditCards embedded />
        </TabsContent>
        <TabsContent value="bills" className="mt-0 flex-1">
          <CreditCardBills embedded />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
