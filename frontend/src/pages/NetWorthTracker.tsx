/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Wallet, Vault as VaultIcon, CreditCard, HandCoins } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { STALE_TIMES } from '@/lib/query-client';
import { accountsService } from '@/services/accounts-service';
import { vaultsService } from '@/services/vaults-service';
import { loansService } from '@/services/loans-service';
import { creditCardsService } from '@/services/credit-cards-service';
import type { Account, Vault, Loan, CreditCard as CreditCardType } from '@/types';

export default function NetWorthTracker() {
  const { t } = useTranslation();

  const accountsQuery = useQuery({
    queryKey: ['accounts', 'netWorth'],
    queryFn: () => accountsService.getAll(),
    staleTime: STALE_TIMES.ACCOUNT_BALANCES,
  });

  const vaultsQuery = useQuery({
    queryKey: ['vaults', 'netWorth'],
    queryFn: () => vaultsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const loansQuery = useQuery({
    queryKey: ['loans', 'netWorth'],
    queryFn: () => loansService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const creditCardsQuery = useQuery({
    queryKey: ['creditCards', 'netWorth'],
    queryFn: () => creditCardsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const isLoading =
    accountsQuery.isLoading ||
    vaultsQuery.isLoading ||
    loansQuery.isLoading ||
    creditCardsQuery.isLoading;

  const {
    positiveAccounts,
    totalBankAssets,
    totalVaultAssets,
    totalLoanLiabilities,
    totalCreditCardLiabilities,
    totalAssets,
    totalLiabilities,
    netWorth,
  } = useMemo(() => {
    const accounts: Account[] = accountsQuery.data ?? [];
    const vaults: Vault[] = vaultsQuery.data ?? [];
    const loans: Loan[] = loansQuery.data ?? [];
    const cards: CreditCardType[] = creditCardsQuery.data ?? [];

    const positiveAccts = accounts.filter((a) => parseFloat(a.balance) > 0);
    const bankAssets = positiveAccts.reduce((s, a) => s + parseFloat(a.balance), 0);

    const vaultAssets = vaults
      .filter((v) => v.is_active)
      .reduce((s, v) => s + parseFloat(v.current_balance), 0);

    const loanLiabilities = loans
      .filter((l) => l.status !== 'paid')
      .reduce((s, l) => s + parseFloat(l.remaining_balance ?? l.value), 0);

    const cardLiabilities = cards.reduce((s, c) => s + (c.used_credit ?? 0), 0);

    const assets = bankAssets + vaultAssets;
    const liabilities = loanLiabilities + cardLiabilities;

    return {
      positiveAccounts: positiveAccts,
      totalBankAssets: bankAssets,
      totalVaultAssets: vaultAssets,
      totalLoanLiabilities: loanLiabilities,
      totalCreditCardLiabilities: cardLiabilities,
      totalAssets: assets,
      totalLiabilities: liabilities,
      netWorth: assets - liabilities,
    };
  }, [accountsQuery.data, vaultsQuery.data, loansQuery.data, creditCardsQuery.data]);

  const pieData = useMemo(() => {
    const data = [];
    if (totalBankAssets > 0) {
      data.push({ name: t('netWorth.bankAccounts'), value: totalBankAssets });
    }
    if (totalVaultAssets > 0) {
      data.push({ name: t('netWorth.vaults'), value: totalVaultAssets });
    }
    if (totalLoanLiabilities > 0) {
      data.push({ name: t('netWorth.loans'), value: totalLoanLiabilities });
    }
    if (totalCreditCardLiabilities > 0) {
      data.push({ name: t('netWorth.creditCards'), value: totalCreditCardLiabilities });
    }
    return data;
  }, [totalBankAssets, totalVaultAssets, totalLoanLiabilities, totalCreditCardLiabilities, t]);

  const PIE_COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#f97316'];

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
              <CardTitle as="h2">{t('netWorth.assetsLabel')} vs {t('netWorth.liabilitiesLabel')}</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-xl text-center text-sm text-muted-foreground">
                  {t('netWorth.noAssets')}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-md">
            <Card>
              <CardHeader className="pb-sm">
                <div className="flex items-center gap-sm">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <CardTitle as="h3" className="text-base">{t('netWorth.assetsSection')}</CardTitle>
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
                  <CardTitle as="h3" className="text-base">{t('netWorth.liabilitiesSection')}</CardTitle>
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
