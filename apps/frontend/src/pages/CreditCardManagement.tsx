import { useQuery } from '@tanstack/react-query';
import { CreditCard, Plus, Receipt } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTabRoute } from '@/hooks/use-tab-route';
import { useToast } from '@/hooks/use-toast';
import { accountsService } from '@/services/accounts-service';

import CreditCardBills from './CreditCardBills';
import CreditCards from './CreditCards';

const TABS = ['cards', 'bills'] as const;

export default function CreditCardManagement() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useTabRoute('/credit-cards', TABS, 'cards');
  const [billsCardFilter, setBillsCardFilter] = useState<string>();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const billCreateRef = useRef<() => void>(undefined);
  const { toast } = useToast();

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.getAll(),
  });

  const handleCreate = () => {
    if (accounts.length === 0) {
      toast({
        title: t('pages.creditCards.noAccountMsg'),
        variant: 'destructive',
      });
      return;
    }
    setIsCreateOpen(true);
  };

  const isBillsTab = activeTab === 'bills';

  return (
    <PageContainer className="flex flex-1 flex-col">
      <PageHeader
        title={t(
          isBillsTab ? 'pages.creditCardBills.title' : 'pages.creditCards.title'
        )}
        icon={isBillsTab ? <Receipt /> : <CreditCard />}
        action={
          isBillsTab
            ? {
                label: t('pages.creditCardBills.newBtn'),
                icon: <Plus className="h-4 w-4" />,
                onClick: () => billCreateRef.current?.(),
              }
            : {
                label: t('pages.creditCards.newBtn'),
                icon: <Plus className="h-4 w-4" />,
                onClick: handleCreate,
              }
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as (typeof TABS)[number])}
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
          <CreditCards
            embedded
            isCreateOpen={isCreateOpen}
            onCreateOpenChange={setIsCreateOpen}
            onShowBills={(cardId) => {
              setBillsCardFilter(String(cardId));
              setActiveTab('bills');
            }}
          />
        </TabsContent>
        <TabsContent value="bills" className="mt-0 flex-1">
          <CreditCardBills
            createRef={billCreateRef}
            key={billsCardFilter}
            embedded
            initialCardFilter={billsCardFilter}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
