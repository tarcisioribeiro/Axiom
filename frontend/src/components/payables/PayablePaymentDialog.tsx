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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { payableInstallmentsService } from '@/services/payable-installments-service';
import type { Account, Payable } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface PayablePaymentDialogProps {
  payable: Payable | null;
  accounts: Account[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function PayablePaymentDialog({
  payable,
  accounts,
  onClose,
  onSuccess,
}: PayablePaymentDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState({
    value: '',
    account: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remaining = payable
    ? parseFloat(payable.value) - parseFloat(payable.paid_value)
    : 0;

  const handleSubmit = async () => {
    if (!payable) return;
    if (!form.value || !form.account || !form.date) {
      toast({
        title: t('pages.payables.payment.title'),
        description: t('common.messages.fillRequired'),
        variant: 'destructive',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await payableInstallmentsService.pay(payable.id, {
        value: parseFloat(form.value),
        account: parseInt(form.account),
        date: form.date,
        notes: form.notes,
      });
      toast({
        title: t('pages.payables.payment.success'),
        description: t('pages.payables.payment.successDesc'),
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
          <DialogTitle>{t('pages.payables.payment.title')}</DialogTitle>
          <DialogDescription>
            {payable?.description} — {t('pages.payables.remainingBalance')}{' '}
            {formatCurrency(remaining)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          <div className="space-y-xs">
            <Label>{t('pages.payables.payment.value')} *</Label>
            <Input
              type="number"
              step="0.01"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-xs">
            <Label>{t('pages.payables.payment.account')} *</Label>
            <Select
              value={form.account}
              onValueChange={(v) => setForm((f) => ({ ...f, account: v }))}
            >
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
            <Label>{t('pages.payables.payment.date')} *</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="space-y-xs">
            <Label>{t('pages.payables.payment.notes')}</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t('common.fields.notes')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting
                ? t('common.actions.saving')
                : t('pages.payables.payment.submit')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
