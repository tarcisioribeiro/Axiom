import { Loader2, RefreshCcw, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { vaultsService } from '@/services/vaults-service';
import type { Vault } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vault: Vault | undefined;
  onSuccess: () => void;
}

export function VaultApplyYieldDialog({ open, onOpenChange, vault, onSuccess }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset the editable amount when the dialog opens for a (possibly new)
  // vault during render rather than in an effect — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const openKey = open ? vault?.id : undefined;
  const [prevOpenKey, setPrevOpenKey] = useState(openKey);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    if (openKey !== undefined && vault) setAmount(String(vault.pending_yield));
  }

  if (!vault) return null;

  const balance = parseFloat(vault.current_balance);
  const parsedAmount = parseFloat(amount) || 0;
  const totalAfter = balance + parsedAmount;

  const handleConfirm = async () => {
    if (parsedAmount <= 0) return;
    try {
      setIsSubmitting(true);
      const response = await vaultsService.applyYield(vault.id, parsedAmount);
      toast({
        title: t('pages.vaults.yieldApplied'),
        description: t('pages.vaults.yieldAppliedDesc', {
          amount: formatCurrency(response.yield_applied),
        }),
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[21rem]">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <RefreshCcw className="text-primary h-4 w-4" aria-hidden="true" />
            {t('pages.vaults.applyYieldBtn')}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>{t('pages.vaults.applyYieldBtn')}</DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        <div className="space-y-md">
          <div>
            <Label htmlFor="apply_yield_amount">
              {t('pages.vaults.applyYieldAmountLabel')}
            </Label>
            <CurrencyInput
              id="apply_yield_amount"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t('pages.vaults.applyYieldTotalAfter')}
            </span>
            <span className="font-semibold">{formatCurrency(totalAfter)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={isSubmitting || parsedAmount <= 0}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            {t('pages.vaults.applyYieldBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
