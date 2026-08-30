import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { nextDueDateOnOrAfterToday } from '@/lib/debt-schedule';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import { payableInstallmentsService } from '@/services/payable-installments-service';
import type { Account, Payable } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const PAYMENT_FREQUENCIES = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
];

interface PaymentPlanDialogProps {
  payable: Payable | null;
  accounts: Account[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function PaymentPlanDialog({
  payable,
  accounts,
  onClose,
  onSuccess,
}: PaymentPlanDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [installments, setInstallments] = useState('2');
  const [account, setAccount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pré-preenche a 1ª parcela ao abrir para um novo payable (nunca no passado).
  const [lastPayableId, setLastPayableId] = useState<number | null>(null);
  if (payable && payable.id !== lastPayableId) {
    setLastPayableId(payable.id);
    setFirstDueDate(nextDueDateOnOrAfterToday(payable.due_date ?? payable.date));
  }

  if (!payable) return null;

  const remaining = parseFloat(payable.value) - parseFloat(payable.paid_value);
  const count = parseInt(installments) || 0;
  const perInstallment = count > 0 ? remaining / count : 0;

  const handleSubmit = async () => {
    if (!account || count < 2) return;
    setIsSubmitting(true);
    try {
      await payableInstallmentsService.createPaymentPlan(payable.id, {
        installments: count,
        account: parseInt(account),
        payment_frequency: frequency,
        first_due_date: firstDueDate || undefined,
      });
      toast({
        title: t('pages.payables.form.paymentPlanCreated'),
        description: t('pages.payables.form.paymentPlanCreatedDesc'),
      });
      onSuccess?.();
      onClose();
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
    <Dialog open={!!payable} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.payables.form.paymentPlanTitle')}</DialogTitle>
          <DialogDescription>
            {payable.description} — {t('pages.payables.form.paymentPlanDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          <div className="space-y-xs">
            <Label>{t('pages.payables.form.installmentsCountLabel')} *</Label>
            <Input
              type="number"
              min={2}
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />
          </div>
          <div className="space-y-xs">
            <Label>{t('pages.payables.form.accountLabel')} *</Label>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger>
                <SelectValue placeholder={t('common.fields.selectAccount')} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-xs">
            <Label>{t('pages.payables.form.paymentFrequencyLabel')}</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_FREQUENCIES.map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {t(`pages.loans.frequencies.${freq}`, { defaultValue: freq })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-xs">
            <Label>{t('pages.payables.form.firstInstallmentLabel')}</Label>
            <DatePicker
              value={firstDueDate}
              clearable={false}
              onChange={(date) => setFirstDueDate(date ? formatLocalDate(date) : '')}
            />
            <p className="text-muted-foreground text-xs">
              {t('pages.payables.form.firstInstallmentHint')}
            </p>
          </div>
          {count >= 2 && (
            <p className="text-muted-foreground text-sm">
              {t('pages.payables.form.installmentValuePreview', {
                count,
                value: formatCurrency(perInstallment.toFixed(2)),
              })}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !account || count < 2}
          >
            {isSubmitting ? t('common.actions.saving') : t('common.actions.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
