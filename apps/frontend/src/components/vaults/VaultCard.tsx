import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  History,
  MoreHorizontal,
  Pencil,
  RefreshCcw,
  Trash2,
  TrendingUp,
  Vault,
} from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  onOpenDetail: (v: VaultType) => void;
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
  onOpenDetail,
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
  // Radix portals the dropdown content outside this card's DOM subtree, so a
  // click on one of its items can still resolve onto the card underneath
  // once the menu closes. Marked on pointerdown (before Radix unmounts the
  // portal), checked once by the card's own click handler.
  const suppressDetailRef = useRef(false);

  return (
    <Card
      className={`overflow-hidden border ${color.border} cursor-pointer`}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if (suppressDetailRef.current) {
          suppressDetailRef.current = false;
          return;
        }
        if (!(e.target as HTMLElement).closest('button')) onOpenDetail(vault);
      }}
      onKeyDown={(e) => {
        if (
          (e.key === 'Enter' || e.key === ' ') &&
          !(e.target as HTMLElement).closest('button')
        ) {
          e.preventDefault();
          onOpenDetail(vault);
        }
      }}
    >
      <div className={`bg-gradient-to-br ${color.bg} px-md pb-md pt-md`}>
        <div className="flex items-start justify-between">
          <div className="gap-sm flex items-center">
            <Vault className={`h-8 w-8 ${color.accent}`} />
            <div>
              <p className="leading-tight font-semibold">{vault.description}</p>
              <p className="text-muted-foreground text-xs">{vault.account_name}</p>
            </div>
          </div>
          <Badge variant={vault.is_active ? 'default' : 'secondary'}>
            {vault.is_active ? t('common.status.active') : t('common.status.inactive')}
          </Badge>
        </div>
        <div className="mt-3">
          <p className="text-muted-foreground text-xs">
            {t('pages.vaults.columns.currentBalance')}
          </p>
          <p className={`text-2xl font-bold ${color.accent}`}>
            {formatCurrency(balance)}
          </p>
        </div>
      </div>
      <CardContent className="pt-3">
        <div
          role="presentation"
          className="gap-xs pt-sm flex flex-wrap items-center justify-end border-t"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDeposit(vault)}
            disabled={!vault.is_active}
            className="gap-xs text-xs"
          >
            <ArrowDownToLine className="text-success h-3 w-3" aria-hidden="true" />
            {t('pages.vaults.depositBtn')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onWithdraw(vault)}
            disabled={!vault.is_active || balance <= 0}
            className="gap-xs text-xs"
          >
            <ArrowUpFromLine className="text-destructive h-3 w-3" aria-hidden="true" />
            {t('pages.vaults.withdrawBtn')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title={t('common.actions.moreOptions')}
                aria-label={t('common.actions.moreOptions')}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onPointerDown={() => {
                suppressDetailRef.current = true;
              }}
            >
              <DropdownMenuItem
                onClick={() => onApplyYield(vault)}
                disabled={!vault.is_active || vault.pending_yield <= 0}
              >
                <RefreshCcw className="mr-sm h-4 w-4" aria-hidden="true" />
                {t('pages.vaults.applyYieldBtn')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTransactions(vault)}>
                <History className="mr-sm h-4 w-4" aria-hidden="true" />
                {t('pages.vaults.transactionsBtn')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onContributions(vault)}>
                <CalendarClock className="mr-sm h-4 w-4" aria-hidden="true" />
                {t('pages.vaults.recurringContributions.btn')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSimulator(vault)}>
                <TrendingUp className="mr-sm h-4 w-4" aria-hidden="true" />
                {t('pages.vaultSimulator.title')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
