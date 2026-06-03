/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Vault as VaultIcon,
  CreditCard,
  HandCoins,
  AlertTriangle,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ChartContainer } from '@/components/charts';
import { AnimatedPage } from '@/components/common/AnimatedPage';
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
import { vaultsService } from '@/services/vaults-service';
import type { Account, Vault, Loan, CreditCard as CreditCardType } from '@/types';

export default function NetWorthTracker() {
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

  const isLoading =
    accountsQuery.isLoading ||
    vaultsQuery.isLoading ||
    loansQuery.isLoading ||
    creditCardsQuery.isLoading;

  const {
    positiveAccounts,
    overdraftAccounts,
    totalBankAssets,
    totalVaultAssets,
    totalLentLoanAssets,
    totalLoanLiabilities,
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

    const positiveAccts = accounts.filter((a) => parseFloat(a.balance) > 0);
    const overdraftAccts = accounts.filter((a) => parseFloat(a.balance) < 0);
    const bankAssets = positiveAccts.reduce((s, a) => s + parseFloat(a.balance), 0);
    const overdraftLiabilities = overdraftAccts.reduce(
      (s, a) => s + Math.abs(parseFloat(a.balance)),
      0
    );

    const vaultAssets = vaults
      .filter((v) => v.is_active)
      .reduce((s, v) => s + parseFloat(v.current_balance), 0);

    const activeLoans = loans.filter((l) => l.status !== 'paid');
    const lentLoans = activeLoans.filter((l) => l.loan_type === 'lent');
    const borrowedLoans = activeLoans.filter((l) => l.loan_type !== 'lent');

    const lentLoanAssets = lentLoans.reduce(
      (s, l) => s + parseFloat(l.remaining_balance ?? l.value),
      0
    );
    const loanLiabilities = borrowedLoans.reduce(
      (s, l) => s + parseFloat(l.remaining_balance ?? l.value),
      0
    );

    const cardLiabilities = cards.reduce((s, c) => s + (c.used_credit ?? 0), 0);

    const assets = bankAssets + vaultAssets + lentLoanAssets;
    const liabilities = loanLiabilities + cardLiabilities + overdraftLiabilities;

    return {
      positiveAccounts: positiveAccts,
      overdraftAccounts: overdraftAccts,
      totalBankAssets: bankAssets,
      totalVaultAssets: vaultAssets,
      totalLentLoanAssets: lentLoanAssets,
      totalLoanLiabilities: loanLiabilities,
      totalCreditCardLiabilities: cardLiabilities,
      totalOverdraftLiabilities: overdraftLiabilities,
      totalAssets: assets,
      totalLiabilities: liabilities,
      netWorth: assets - liabilities,
    };
  }, [accountsQuery.data, vaultsQuery.data, loansQuery.data, creditCardsQuery.data]);

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
    if (totalLoanLiabilities > 0) {
      data.push({ name: t('netWorth.loans'), value: totalLoanLiabilities });
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
    totalLoanLiabilities,
    totalCreditCardLiabilities,
    totalOverdraftLiabilities,
    t,
  ]);

  if (isLoading) return <LoadingState fullScreen />;

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('netWorth.title')}
          icon={<TrendingUp />}
          subtitle={t('netWorth.subtitle')}
        />

        <div className="mt-md grid grid-cols-1 gap-md md:grid-cols-3">
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

        <div className="mt-md grid grid-cols-1 gap-md lg:grid-cols-2">
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
                <div className="flex items-center gap-sm">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <CardTitle as="h3" className="text-base">
                    {t('netWorth.assetsSection')}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-sm">
                <div className="flex items-center justify-between rounded-lg bg-success/5 p-sm">
                  <div className="flex items-center gap-sm">
                    <Wallet className="h-4 w-4 text-success" />
                    <span className="text-sm">{t('netWorth.bankAccounts')}</span>
                  </div>
                  <span className="font-semibold text-success">
                    {formatCurrency(totalBankAssets)}
                  </span>
                </div>
                {positiveAccounts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between px-sm text-xs text-muted-foreground"
                  >
                    <span>{a.account_name}</span>
                    <span className="font-medium text-success">
                      {formatCurrency(parseFloat(a.balance))}
                    </span>
                  </div>
                ))}
                {totalVaultAssets > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-blue-500/5 p-sm">
                    <div className="flex items-center gap-sm">
                      <VaultIcon className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{t('netWorth.vaults')}</span>
                    </div>
                    <span className="font-semibold text-blue-500">
                      {formatCurrency(totalVaultAssets)}
                    </span>
                  </div>
                )}
                {totalLentLoanAssets > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-teal-500/5 p-sm">
                    <div className="flex items-center gap-sm">
                      <HandCoins className="h-4 w-4 text-teal-500" />
                      <span className="text-sm">{t('netWorth.lentLoans')}</span>
                    </div>
                    <span className="font-semibold text-teal-500">
                      {formatCurrency(totalLentLoanAssets)}
                    </span>
                  </div>
                )}
                {totalAssets === 0 && (
                  <p className="py-md text-center text-sm text-muted-foreground">
                    {t('netWorth.noAssets')}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-sm">
                <div className="flex items-center gap-sm">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <CardTitle as="h3" className="text-base">
                    {t('netWorth.liabilitiesSection')}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-sm">
                {totalLoanLiabilities > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-destructive/5 p-sm">
                    <div className="flex items-center gap-sm">
                      <HandCoins className="h-4 w-4 text-destructive" />
                      <span className="text-sm">{t('netWorth.loans')}</span>
                    </div>
                    <span className="font-semibold text-destructive">
                      {formatCurrency(totalLoanLiabilities)}
                    </span>
                  </div>
                )}
                {totalCreditCardLiabilities > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-orange-500/5 p-sm">
                    <div className="flex items-center gap-sm">
                      <CreditCard className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">{t('netWorth.creditCards')}</span>
                    </div>
                    <span className="font-semibold text-orange-500">
                      {formatCurrency(totalCreditCardLiabilities)}
                    </span>
                  </div>
                )}
                {totalOverdraftLiabilities > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-destructive/5 p-sm">
                    <div className="flex items-center gap-sm">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="text-sm">{t('netWorth.overdraft')}</span>
                    </div>
                    <span className="font-semibold text-destructive">
                      {formatCurrency(totalOverdraftLiabilities)}
                    </span>
                  </div>
                )}
                {totalOverdraftLiabilities > 0 &&
                  overdraftAccounts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between px-sm text-xs text-muted-foreground"
                    >
                      <span>{a.account_name}</span>
                      <span className="font-medium text-destructive">
                        {formatCurrency(parseFloat(a.balance))}
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
      </PageContainer>
    </AnimatedPage>
  );
}
