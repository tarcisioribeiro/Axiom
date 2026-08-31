/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  VaultIcon,
  CreditCard,
  HandCoins,
  AlertTriangle,
  ArrowDownCircle as ReceivableIcon,
  ArrowUpCircle as PayableIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ChartContainer } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChartColors } from '@/lib/chart-colors';
import { formatCurrency } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { loansService } from '@/services/loans-service';
import { payablesService } from '@/services/payables-service';
import { receivablesService } from '@/services/receivables-service';
import { vaultsService } from '@/services/vaults-service';
import type {
  Account,
  Vault,
  Loan,
  CreditCard as CreditCardType,
  Payable,
  Receivable,
} from '@/types';

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function NetWorthTracker({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();

  const accountsQuery = useQuery({
    queryKey: ['accounts', 'netWorth'],
    queryFn: () => accountsService.getAllPages(),
    staleTime: STALE_TIMES.ACCOUNT_BALANCES,
  });

  const vaultsQuery = useQuery({
    queryKey: ['vaults', 'netWorth'],
    queryFn: () => vaultsService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const loansQuery = useQuery({
    queryKey: ['loans', 'netWorth'],
    queryFn: () => loansService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const creditCardsQuery = useQuery({
    queryKey: ['creditCards', 'netWorth'],
    queryFn: () => creditCardsService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const payablesQuery = useQuery({
    queryKey: ['payables', 'netWorth'],
    queryFn: () => payablesService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const receivablesQuery = useQuery({
    queryKey: ['receivables', 'netWorth'],
    queryFn: () => receivablesService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const isLoading =
    accountsQuery.isLoading ||
    vaultsQuery.isLoading ||
    loansQuery.isLoading ||
    creditCardsQuery.isLoading ||
    payablesQuery.isLoading ||
    receivablesQuery.isLoading;

  const {
    positiveAccounts,
    overdraftAccounts,
    totalBankAssets,
    totalVaultAssets,
    totalLentLoanAssets,
    totalReceivableAssets,
    totalLoanLiabilities,
    totalPayableLiabilities,
    totalCreditCardLiabilities,
    totalOverdraftLiabilities,
    totalAssets,
    totalLiabilities,
    netWorth,
  } = useMemo(() => {
    const accounts: Account[] = accountsQuery.data ?? [];
    const vaults: Vault[] = vaultsQuery.data ?? [];
    const loans: Loan[] = loansQuery.data ?? [];
    const cards: CreditCardType[] = creditCardsQuery.data ?? [];
    const payables: Payable[] = payablesQuery.data ?? [];
    const receivables: Receivable[] = receivablesQuery.data ?? [];

    // O saldo disponível já desconta o que está reservado em cofres — evita
    // contar o dinheiro do cofre duas vezes (na conta e na linha de cofres).
    const availableOf = (a: Account) => parseFloat(a.available_balance ?? a.balance);

    const positiveAccts = accounts.filter((a) => availableOf(a) > 0);
    const overdraftAccts = accounts.filter((a) => availableOf(a) < 0);
    const bankAssets = positiveAccts.reduce((s, a) => s + availableOf(a), 0);
    const overdraftLiabilities = overdraftAccts.reduce(
      (s, a) => s + Math.abs(availableOf(a)),
      0
    );

    const vaultAssets = vaults
      .filter((v) => v.is_active)
      .reduce((s, v) => s + parseFloat(v.current_balance), 0);

    const activeLoans = loans.filter((l) => l.status !== 'paid');
    const lentLoans = activeLoans.filter((l) => l.loan_type === 'lent');
    const borrowedLoans = activeLoans.filter((l) => l.loan_type === 'borrowed');

    const lentLoanAssets = lentLoans.reduce(
      (s, l) => s + parseFloat(l.remaining_balance ?? l.value),
      0
    );
    const loanLiabilities = borrowedLoans.reduce(
      (s, l) => s + parseFloat(l.remaining_balance ?? l.value),
      0
    );

    const cardLiabilities = cards.reduce((s, c) => s + (c.used_credit ?? 0), 0);

    // Valores a receber ainda em aberto (fora received/cancelled) — ativo.
    const openReceivables = receivables.filter(
      (r) => r.status !== 'received' && r.status !== 'cancelled'
    );
    const receivableAssets = openReceivables.reduce(
      (s, r) => s + parseFloat(r.remaining_value ?? r.value),
      0
    );

    // Valores a pagar ainda em aberto (fora paid/cancelled) — passivo.
    const openPayables = payables.filter(
      (p) => p.status !== 'paid' && p.status !== 'cancelled'
    );
    const payableLiabilities = openPayables.reduce(
      (s, p) => s + parseFloat(p.remaining_value ?? p.value),
      0
    );

    const assets = bankAssets + vaultAssets + lentLoanAssets + receivableAssets;
    const liabilities =
      loanLiabilities + cardLiabilities + overdraftLiabilities + payableLiabilities;

    return {
      positiveAccounts: positiveAccts,
      overdraftAccounts: overdraftAccts,
      totalBankAssets: bankAssets,
      totalVaultAssets: vaultAssets,
      totalLentLoanAssets: lentLoanAssets,
      totalReceivableAssets: receivableAssets,
      totalLoanLiabilities: loanLiabilities,
      totalPayableLiabilities: payableLiabilities,
      totalCreditCardLiabilities: cardLiabilities,
      totalOverdraftLiabilities: overdraftLiabilities,
      totalAssets: assets,
      totalLiabilities: liabilities,
      netWorth: assets - liabilities,
    };
  }, [
    accountsQuery.data,
    vaultsQuery.data,
    loansQuery.data,
    creditCardsQuery.data,
    payablesQuery.data,
    receivablesQuery.data,
  ]);

  const chartColors = useChartColors();

  const pieData = useMemo(() => {
    const data = [];
    if (totalBankAssets > 0) {
      data.push({ name: t('netWorth.bankAccounts'), value: totalBankAssets });
    }
    if (totalVaultAssets > 0) {
      data.push({ name: t('netWorth.vaults'), value: totalVaultAssets });
    }
    if (totalLentLoanAssets > 0) {
      data.push({ name: t('netWorth.lentLoans'), value: totalLentLoanAssets });
    }
    if (totalReceivableAssets > 0) {
      data.push({ name: t('netWorth.receivables'), value: totalReceivableAssets });
    }
    if (totalLoanLiabilities > 0) {
      data.push({ name: t('netWorth.loans'), value: totalLoanLiabilities });
    }
    if (totalPayableLiabilities > 0) {
      data.push({ name: t('netWorth.payables'), value: totalPayableLiabilities });
    }
    if (totalCreditCardLiabilities > 0) {
      data.push({ name: t('netWorth.creditCards'), value: totalCreditCardLiabilities });
    }
    if (totalOverdraftLiabilities > 0) {
      data.push({ name: t('netWorth.overdraft'), value: totalOverdraftLiabilities });
    }
    return data;
  }, [
    totalBankAssets,
    totalVaultAssets,
    totalLentLoanAssets,
    totalReceivableAssets,
    totalLoanLiabilities,
    totalPayableLiabilities,
    totalCreditCardLiabilities,
    totalOverdraftLiabilities,
    t,
  ]);

  if (isLoading) return <LoadingState fullScreen />;

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  return (
    <Wrapper>
      <PageHeader
        title={t('netWorth.title')}
        icon={<TrendingUp />}
        subtitle={t('netWorth.subtitle')}
      />

      <div className="mt-md gap-md grid grid-cols-1 md:grid-cols-3">
        <StatCard
          title={t('netWorth.netWorthLabel')}
          value={formatCurrency(netWorth)}
          icon={<Wallet className="h-5 w-5" />}
          accentColor={netWorth >= 0 ? 'green' : 'red'}
          prominent
        />
        <StatCard
          title={t('netWorth.assetsLabel')}
          value={formatCurrency(totalAssets)}
          icon={<TrendingUp className="h-4 w-4" />}
          accentColor="green"
        />
        <StatCard
          title={t('netWorth.liabilitiesLabel')}
          value={formatCurrency(totalLiabilities)}
          icon={<TrendingDown className="h-4 w-4" />}
          accentColor="red"
        />
      </div>

      <div className="mt-md gap-md grid grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-sm">
            <CardTitle as="h2">
              {t('netWorth.assetsLabel')} vs {t('netWorth.liabilitiesLabel')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              chartId="net-worth-distribution"
              data={pieData}
              dataKey="value"
              nameKey="name"
              formatter={(v) => formatCurrency(Number(v))}
              colors={chartColors}
              emptyMessage={t('netWorth.noAssets')}
              lockChartType="pie"
              height={280}
            />
          </CardContent>
        </Card>

        <div className="space-y-md">
          <Card>
            <CardHeader className="pb-sm">
              <div className="gap-sm flex items-center">
                <TrendingUp className="text-success h-4 w-4" />
                <CardTitle as="h3" className="text-base">
                  {t('netWorth.assetsSection')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-sm">
              <div className="bg-success/5 p-sm flex items-center justify-between rounded-lg">
                <div className="gap-sm flex items-center">
                  <Wallet className="text-success h-4 w-4" />
                  <span className="text-sm">{t('netWorth.bankAccounts')}</span>
                </div>
                <span className="text-success font-semibold">
                  {formatCurrency(totalBankAssets)}
                </span>
              </div>
              {positiveAccounts.map((a) => (
                <div
                  key={a.id}
                  className="px-sm text-muted-foreground flex items-center justify-between text-xs"
                >
                  <span>{a.account_name}</span>
                  <span className="text-success font-medium">
                    {formatCurrency(parseFloat(a.available_balance ?? a.balance))}
                  </span>
                </div>
              ))}
              {totalVaultAssets > 0 && (
                <div className="p-sm flex items-center justify-between rounded-lg bg-blue-500/5">
                  <div className="gap-sm flex items-center">
                    <VaultIcon className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">{t('netWorth.vaults')}</span>
                  </div>
                  <span className="font-semibold text-blue-500">
                    {formatCurrency(totalVaultAssets)}
                  </span>
                </div>
              )}
              {totalLentLoanAssets > 0 && (
                <div className="p-sm flex items-center justify-between rounded-lg bg-teal-500/5">
                  <div className="gap-sm flex items-center">
                    <HandCoins className="h-4 w-4 text-teal-500" />
                    <span className="text-sm">{t('netWorth.lentLoans')}</span>
                  </div>
                  <span className="font-semibold text-teal-500">
                    {formatCurrency(totalLentLoanAssets)}
                  </span>
                </div>
              )}
              {totalReceivableAssets > 0 && (
                <div className="p-sm flex items-center justify-between rounded-lg bg-emerald-500/5">
                  <div className="gap-sm flex items-center">
                    <ReceivableIcon className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm">{t('netWorth.receivables')}</span>
                  </div>
                  <span className="font-semibold text-emerald-500">
                    {formatCurrency(totalReceivableAssets)}
                  </span>
                </div>
              )}
              {totalAssets === 0 && (
                <p className="py-md text-muted-foreground text-center text-sm">
                  {t('netWorth.noAssets')}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-sm">
              <div className="gap-sm flex items-center">
                <TrendingDown className="text-destructive h-4 w-4" />
                <CardTitle as="h3" className="text-base">
                  {t('netWorth.liabilitiesSection')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-sm">
              {totalLoanLiabilities > 0 && (
                <div className="bg-destructive/5 p-sm flex items-center justify-between rounded-lg">
                  <div className="gap-sm flex items-center">
                    <HandCoins className="text-destructive h-4 w-4" />
                    <span className="text-sm">{t('netWorth.loans')}</span>
                  </div>
                  <span className="text-destructive font-semibold">
                    {formatCurrency(totalLoanLiabilities)}
                  </span>
                </div>
              )}
              {totalPayableLiabilities > 0 && (
                <div className="bg-destructive/5 p-sm flex items-center justify-between rounded-lg">
                  <div className="gap-sm flex items-center">
                    <PayableIcon className="text-destructive h-4 w-4" />
                    <span className="text-sm">{t('netWorth.payables')}</span>
                  </div>
                  <span className="text-destructive font-semibold">
                    {formatCurrency(totalPayableLiabilities)}
                  </span>
                </div>
              )}
              {totalCreditCardLiabilities > 0 && (
                <div className="p-sm flex items-center justify-between rounded-lg bg-orange-500/5">
                  <div className="gap-sm flex items-center">
                    <CreditCard className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">{t('netWorth.creditCards')}</span>
                  </div>
                  <span className="font-semibold text-orange-500">
                    {formatCurrency(totalCreditCardLiabilities)}
                  </span>
                </div>
              )}
              {totalOverdraftLiabilities > 0 && (
                <div className="bg-destructive/5 p-sm flex items-center justify-between rounded-lg">
                  <div className="gap-sm flex items-center">
                    <AlertTriangle className="text-destructive h-4 w-4" />
                    <span className="text-sm">{t('netWorth.overdraft')}</span>
                  </div>
                  <span className="text-destructive font-semibold">
                    {formatCurrency(totalOverdraftLiabilities)}
                  </span>
                </div>
              )}
              {totalOverdraftLiabilities > 0 &&
                overdraftAccounts.map((a) => (
                  <div
                    key={a.id}
                    className="px-sm text-muted-foreground flex items-center justify-between text-xs"
                  >
                    <span>{a.account_name}</span>
                    <span className="text-destructive font-medium">
                      {formatCurrency(parseFloat(a.available_balance ?? a.balance))}
                    </span>
                  </div>
                ))}
              {totalLiabilities === 0 && (
                <p
                  className={cn(
                    'py-md text-center text-sm',
                    totalLiabilities === 0 ? 'text-success' : 'text-muted-foreground'
                  )}
                >
                  {t('netWorth.noLiabilities')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Wrapper>
  );
}
