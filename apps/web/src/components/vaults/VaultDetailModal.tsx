import { Sparkles, Vault as VaultIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/formatters';
import type { Vault } from '@/types';

interface Props {
  vault: Vault | null;
  totalBalance: number;
  onClose: () => void;
}

export function VaultDetailModal({ vault, totalBalance, onClose }: Props) {
  const { t } = useTranslation();

  if (!vault) return null;

  const balance = parseFloat(vault.current_balance);
  const accYield = parseFloat(vault.accumulated_yield);
  const proportion =
    totalBalance > 0 ? Math.min(100, (balance / totalBalance) * 100) : 0;

  return (
    <Dialog open={!!vault} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center text-lg">
            <VaultIcon className="h-5 w-5" aria-hidden="true" />
            {vault.description}
          </DialogTitle>
          <DialogDescription className="sr-only">{vault.description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start justify-between">
          <p className="text-muted-foreground text-sm">{vault.account_name}</p>
          <Badge variant={vault.is_active ? 'default' : 'secondary'}>
            {vault.is_active ? t('common.status.active') : t('common.status.inactive')}
          </Badge>
        </div>

        <div>
          <p className="text-muted-foreground text-xs">
            {t('pages.vaults.columns.currentBalance')}
          </p>
          <p className="text-2xl font-bold">{formatCurrency(balance)}</p>
        </div>

        <div className="gap-md grid grid-cols-2">
          <div>
            <p className="gap-xs text-muted-foreground flex items-center text-xs">
              <Sparkles className="text-warning h-3.5 w-3.5" aria-hidden="true" />
              {t('pages.vaults.columns.yields')}
            </p>
            <p className="text-warning font-semibold">{formatCurrency(accYield)}</p>
          </div>
          {vault.pending_yield > 0 && (
            <div>
              <p className="text-muted-foreground text-xs">
                {t('pages.vaults.pending')}
              </p>
              <p className="text-info font-semibold">
                +{formatCurrency(vault.pending_yield)}
              </p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground text-xs">
              {t('pages.vaults.columns.rate')}
            </p>
            <Badge variant="outline">
              {vault.annual_yield_rate_percentage.toFixed(2)}%{' '}
              {t('pages.vaults.perYear')}
            </Badge>
          </div>
        </div>

        {totalBalance > 0 && (
          <div className="space-y-xs">
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{t('pages.vaults.proportionLabel')}</span>
              <span>{proportion.toFixed(1)}%</span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${proportion}%` }}
              />
            </div>
          </div>
        )}

        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}
