import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  History,
  Pencil,
  RefreshCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  Vault,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import type { Vault as VaultType } from '@/types';

const VAULT_COLORS = [
  {
    bg: 'from-emerald-500/20 to-teal-500/10',
    accent: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    barColor: 'hsl(var(--success))',
  },
  {
    bg: 'from-blue-500/20 to-indigo-500/10',
    accent: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
    barColor: 'hsl(var(--info))',
  },
  {
    bg: 'from-violet-500/20 to-purple-500/10',
    accent: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/30',
    barColor: 'hsl(var(--primary))',
  },
  {
    bg: 'from-amber-500/20 to-orange-500/10',
    accent: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    barColor: 'hsl(var(--warning))',
  },
  {
    bg: 'from-rose-500/20 to-pink-500/10',
    accent: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/30',
    barColor: 'hsl(var(--destructive))',
  },
  {
    bg: 'from-cyan-500/20 to-sky-500/10',
    accent: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-500/30',
    barColor: 'hsl(var(--accent))',
  },
];

interface VaultCardProps {
  vault: VaultType;
  index: number;
  totalBalance: number;
  onDeposit: (v: VaultType) => void;
  onWithdraw: (v: VaultType) => void;
  onApplyYield: (v: VaultType) => void;
  onTransactions: (v: VaultType) => void;
  onContributions: (v: VaultType) => void;
  onSimulator: (v: VaultType) => void;
  onEdit: (v: VaultType) => void;
  onDelete: (id: number) => void;
}

export function VaultCard({
  vault,
  index,
  totalBalance,
  onDeposit,
  onWithdraw,
  onApplyYield,
  onTransactions,
  onContributions,
  onSimulator,
  onEdit,
  onDelete,
}: VaultCardProps) {
  const { t } = useTranslation();
  const color = VAULT_COLORS[index % VAULT_COLORS.length];
  const balance = parseFloat(vault.current_balance);
  const accYield = parseFloat(vault.accumulated_yield);
  const proportion =
    totalBalance > 0 ? Math.min(100, (balance / totalBalance) * 100) : 0;

  return (
    <Card className={`overflow-hidden border ${color.border}`}>
      <div className={`bg-gradient-to-br ${color.bg} px-md pb-md pt-md`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-sm">
            <Vault className={`h-8 w-8 ${color.accent}`} />
            <div>
              <p className="font-semibold leading-tight">{vault.description}</p>
              <p className="text-xs text-muted-foreground">{vault.account_name}</p>
            </div>
          </div>
          <Badge variant={vault.is_active ? 'default' : 'secondary'}>
            {vault.is_active ? t('common.status.active') : t('common.status.inactive')}
          </Badge>
        </div>
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">
            {t('pages.vaults.columns.currentBalance')}
          </p>
          <p className={`text-2xl font-bold ${color.accent}`}>
            {formatCurrency(balance)}
          </p>
        </div>
      </div>
      <CardContent className="space-y-3 pt-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-xs text-amber-500">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t('pages.vaults.columns.yields')}</span>
          </div>
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            {formatCurrency(accYield)}
          </span>
        </div>
        {vault.pending_yield > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('pages.vaults.pending')}</span>
            <span className="font-medium text-info">
              +{formatCurrency(vault.pending_yield)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t('pages.vaults.columns.rate')}
          </span>
          <Badge variant="outline">
            {vault.annual_yield_rate_percentage.toFixed(2)}% {t('pages.vaults.perYear')}
          </Badge>
        </div>
        {totalBalance > 0 && (
          <div className="space-y-xs">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('pages.vaults.proportionLabel')}</span>
              <span>{proportion.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${proportion}%`, backgroundColor: color.barColor }}
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-xs border-t pt-sm">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDeposit(vault)}
            aria-label={t('pages.vaults.depositBtn')}
            title={t('pages.vaults.depositBtn')}
            disabled={!vault.is_active}
          >
            <ArrowDownToLine className="h-4 w-4 text-success" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onWithdraw(vault)}
            aria-label={t('pages.vaults.withdrawBtn')}
            title={t('pages.vaults.withdrawBtn')}
            disabled={!vault.is_active || balance <= 0}
          >
            <ArrowUpFromLine className="h-4 w-4 text-destructive" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onApplyYield(vault)}
            aria-label={t('pages.vaults.applyYieldBtn')}
            title={t('pages.vaults.applyYieldBtn')}
            disabled={!vault.is_active || vault.pending_yield <= 0}
          >
            <RefreshCcw className="h-4 w-4 text-info" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onTransactions(vault)}
            aria-label={t('pages.vaults.transactionsBtn')}
            title={t('pages.vaults.transactionsBtn')}
          >
            <History className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onContributions(vault)}
            aria-label={t('pages.vaults.recurringContributions.btn')}
            title={t('pages.vaults.recurringContributions.btn')}
          >
            <CalendarClock className="h-4 w-4 text-info" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSimulator(vault)}
            title={t('pages.vaultSimulator.title')}
            aria-label={t('pages.vaultSimulator.title')}
          >
            <TrendingUp className="h-4 w-4 text-info" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(vault)}
            title={t('common.actions.edit')}
            aria-label={t('common.actions.edit')}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(vault.id)}
            title={t('common.actions.delete')}
            aria-label={t('common.actions.delete')}
          >
            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
