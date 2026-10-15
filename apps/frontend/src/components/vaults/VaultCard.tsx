import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  History,
  RefreshCcw,
  TrendingUp,
  Vault,
} from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { CardActions } from '@/components/common/CardActions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import type { Vault as VaultType } from '@/types';

interface VaultCardProps {
  vault: VaultType;
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
  const balance = parseFloat(vault.current_balance);
  // Radix portals the dropdown content outside this card's DOM subtree, so a
  // click on one of its items can still resolve onto the card underneath
  // once the menu closes. Marked on pointerdown (before Radix unmounts the
  // portal), checked once by the card's own click handler.
  const suppressDetailRef = useRef(false);

  return (
    <Card
      className="cursor-pointer overflow-hidden"
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
      <div className="p-md">
        <div className="flex items-start justify-between">
          <div className="gap-sm flex items-center">
            <Vault className="text-primary h-8 w-8" />
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
          <p className="text-2xl font-bold">{formatCurrency(balance)}</p>
        </div>
      </div>
      <CardContent className="pt-3">
        <div
          role="presentation"
          className="gap-xs pt-sm flex flex-wrap items-center justify-end border-t"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <CardActions
            onEdit={() => onEdit(vault)}
            onDelete={() => onDelete(vault.id)}
            onMenuPointerDown={() => {
              suppressDetailRef.current = true;
            }}
            menuActions={[
              {
                icon: ArrowDownToLine,
                label: t('pages.vaults.depositBtn'),
                onClick: () => onDeposit(vault),
                color: 'deposit',
                disabled: !vault.is_active,
              },
              {
                icon: ArrowUpFromLine,
                label: t('pages.vaults.withdrawBtn'),
                onClick: () => onWithdraw(vault),
                color: 'withdraw',
                disabled: !vault.is_active || balance <= 0,
              },
              {
                icon: RefreshCcw,
                label: t('pages.vaults.applyYieldBtn'),
                onClick: () => onApplyYield(vault),
                color: 'yield',
                disabled: !vault.is_active || vault.pending_yield <= 0,
              },
              {
                icon: History,
                label: t('pages.vaults.transactionsBtn'),
                onClick: () => onTransactions(vault),
                color: 'transactions',
              },
              {
                icon: CalendarClock,
                label: t('pages.vaults.recurringContributions.btn'),
                onClick: () => onContributions(vault),
                color: 'contributions',
              },
              {
                icon: TrendingUp,
                label: t('pages.vaultSimulator.title'),
                onClick: () => onSimulator(vault),
                color: 'simulator',
              },
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
