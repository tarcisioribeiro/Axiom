import { CreditCard, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Navegação das abas de /transactions — renderizada dentro de cada aba
 * (Despesas/Receitas/Cartão), logo abaixo do respectivo PageHeader. Os
 * `TabsTrigger` compartilham o contexto do `Tabs.Root` em Transactions.tsx,
 * então funcionam normalmente mesmo duplicados em cada conteúdo. */
export function TransactionsTabsNav() {
  const { t } = useTranslation();

  return (
    <TabsList className="w-full">
      <TabsTrigger value="expenses" className="gap-xs flex-1">
        <TrendingDown className="h-4 w-4" />
        {t('pages.expenses.title')}
      </TabsTrigger>
      <TabsTrigger value="revenues" className="gap-xs flex-1">
        <TrendingUp className="h-4 w-4" />
        {t('pages.revenues.title')}
      </TabsTrigger>
      <TabsTrigger value="credit-card-expenses" className="gap-xs flex-1">
        <CreditCard className="h-4 w-4" />
        {t('nav.items.creditCardExpenses')}
      </TabsTrigger>
    </TabsList>
  );
}
