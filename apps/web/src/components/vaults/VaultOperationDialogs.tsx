/* eslint-disable max-lines */
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  Loader2,
  Wallet,
  X,
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { vaultsService } from '@/services/vaults-service';
import type { Vault } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface DepositProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vault: Vault | undefined;
  onSuccess: () => void;
}

export function VaultDepositDialog({
  open,
  onOpenChange,
  vault,
  onSuccess,
}: DepositProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDeposit = async () => {
    if (!vault) return;
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      toast({
        title: t('pages.vaults.invalidDepositDesc'),
        variant: 'destructive',
      });
      return;
    }
    try {
      setIsSubmitting(true);
      await vaultsService.deposit(vault.id, {
        amount: parsed,
        description: description || undefined,
      });
      toast({
        title: t('pages.vaults.depositSuccessDesc', {
          amount: formatCurrency(parsed),
        }),
      });
      onOpenChange(false);
      setAmount('');
      setDescription('');
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
            <ArrowDownToLine className="text-primary h-4 w-4" aria-hidden="true" />
            {t('pages.vaults.depositTitle')}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>{t('pages.vaults.depositTitle')}</DialogDescription>
          </VisuallyHidden>
        </DialogHeader>
        <div className="space-y-md">
          <div>
            <Label className="gap-xs flex items-center" htmlFor="deposit_amount">
              <Wallet className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.vaults.depositAmountLabel')}
            </Label>
            <CurrencyInput
              id="deposit_amount"
              min="0.01"
              max={vault ? parseFloat(vault.account_available_balance) : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label className="gap-xs flex items-center" htmlFor="deposit_description">
              <FileText className="text-muted-foreground h-3.5 w-3.5" />
              {t('common.fields.description')}
            </Label>
            <Input
              id="deposit_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('pages.vaults.depositPlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={() => void handleDeposit()}
            disabled={isSubmitting || !amount}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowDownToLine className="h-4 w-4" />
            )}
            {isSubmitting
              ? t('pages.vaults.depositAction')
              : t('pages.vaults.depositBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface WithdrawProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vault: Vault | undefined;
  onSuccess: () => void;
}

export function VaultWithdrawDialog({
  open,
  onOpenChange,
  vault,
  onSuccess,
}: WithdrawProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleWithdraw = async () => {
    if (!vault) return;
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      toast({
        title: t('pages.vaults.invalidWithdrawDesc'),
        variant: 'destructive',
      });
      return;
    }
    try {
      setIsSubmitting(true);
      await vaultsService.withdraw(vault.id, {
        amount: parsed,
        description: description || undefined,
      });
      toast({
        title: t('pages.vaults.withdrawSuccessDesc', {
          amount: formatCurrency(parsed),
        }),
      });
      onOpenChange(false);
      setAmount('');
      setDescription('');
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
            <ArrowUpFromLine className="text-primary h-4 w-4" aria-hidden="true" />
            {t('pages.vaults.withdrawTitle')}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>{t('pages.vaults.withdrawTitle')}</DialogDescription>
          </VisuallyHidden>
        </DialogHeader>
        <div className="space-y-md">
          <div>
            <Label className="gap-xs flex items-center" htmlFor="withdraw_amount">
              <Wallet className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.vaults.withdrawAmountLabel')}
            </Label>
            <CurrencyInput
              id="withdraw_amount"
              min="0.01"
              max={vault ? parseFloat(vault.current_balance) : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label className="gap-xs flex items-center" htmlFor="withdraw_description">
              <FileText className="text-muted-foreground h-3.5 w-3.5" />
              {t('common.fields.description')}
            </Label>
            <Input
              id="withdraw_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('pages.vaults.withdrawPlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleWithdraw()}
            disabled={isSubmitting || !amount}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpFromLine className="h-4 w-4" />
            )}
            {isSubmitting
              ? t('pages.vaults.withdrawAction')
              : t('pages.vaults.withdrawBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
