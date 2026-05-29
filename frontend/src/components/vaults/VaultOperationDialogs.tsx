import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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
        title: t('pages.vaults.invalidAmount'),
        description: t('pages.vaults.invalidDepositDesc'),
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
        title: t('pages.vaults.depositSuccess'),
        description: t('pages.vaults.depositSuccessDesc', {
          amount: formatCurrency(parsed),
        }),
      });
      onOpenChange(false);
      setAmount('');
      setDescription('');
      onSuccess();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pages.vaults.depositTitle')}</DialogTitle>
          <DialogDescription>
            {vault && (
              <>
                {t('pages.vaults.depositVaultDesc', { name: vault.description })}
                <br />
                {t('pages.vaults.availableAccountBalance')}{' '}
                {formatCurrency(parseFloat(vault.account_balance))}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          <div>
            <Label htmlFor="deposit_amount">
              {t('pages.vaults.depositAmountLabel')}
            </Label>
            <Input
              id="deposit_amount"
              type="number"
              step="0.01"
              min="0.01"
              max={vault ? parseFloat(vault.account_balance) : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <Label htmlFor="deposit_description">
              {t('common.fields.description')}
            </Label>
            <Input
              id="deposit_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Depósito mensal"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={() => void handleDeposit()}
            disabled={isSubmitting || !amount}
          >
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
        title: t('pages.vaults.invalidAmount'),
        description: t('pages.vaults.invalidWithdrawDesc'),
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
        title: t('pages.vaults.withdrawSuccess'),
        description: t('pages.vaults.withdrawSuccessDesc', {
          amount: formatCurrency(parsed),
        }),
      });
      onOpenChange(false);
      setAmount('');
      setDescription('');
      onSuccess();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pages.vaults.withdrawTitle')}</DialogTitle>
          <DialogDescription>
            {vault && (
              <>
                {t('pages.vaults.withdrawVaultDesc', { name: vault.description })}
                <br />
                {t('pages.vaults.availableVaultBalance')}{' '}
                {formatCurrency(parseFloat(vault.current_balance))}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          <div>
            <Label htmlFor="withdraw_amount">
              {t('pages.vaults.withdrawAmountLabel')}
            </Label>
            <Input
              id="withdraw_amount"
              type="number"
              step="0.01"
              min="0.01"
              max={vault ? parseFloat(vault.current_balance) : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <Label htmlFor="withdraw_description">
              {t('common.fields.description')}
            </Label>
            <Input
              id="withdraw_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Saque para emergência"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleWithdraw()}
            disabled={isSubmitting || !amount}
          >
            {isSubmitting
              ? t('pages.vaults.withdrawAction')
              : t('pages.vaults.withdrawBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
