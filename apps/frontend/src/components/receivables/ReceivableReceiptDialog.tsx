import {
  ExclamationCircleIcon as AlertCircle,
  CalendarDateRangeIcon as CalendarClock,
  WalletIcon as Wallet,
} from '@heroicons/react/24/solid';
import { useQuery } from '@tanstack/react-query';
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
import { useNow } from '@/hooks/use-now';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { receivablesService } from '@/services/receivables-service';
import type { Account, Receivable } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface ReceivableReceiptDialogProps {
  receivable: Receivable | null;
  accounts: Account[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReceivableReceiptDialog({
  receivable,
  accounts,
  onClose,
  onSuccess,
}: ReceivableReceiptDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const now = useNow();
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    value: '',
    account: '',
    date: today,
    notes: '',
  });
  const [scheduled, setScheduled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remaining = receivable
    ? parseFloat(receivable.value) - parseFloat(receivable.received_value)
    : 0;
  const isFutureDate = form.date > today;

  const { data: projectedBalance = null, isLoading: isLoadingProjected } = useQuery({
    queryKey: ['projected-balance', form.account, form.date],
    queryFn: async () => {
      const accountId = parseInt(form.account);
      try {
        const data = await accountsService.getProjectedBalance(accountId, form.date);
        return data.projected_balance;
      } catch {
        return null;
      }
    },
    enabled:
      !!form.account && !!form.date && !!form.value && (isFutureDate || scheduled),
  });

  const handleSubmit = async () => {
    if (!receivable) return;
    if (!form.value || !form.account || !form.date) {
      toast({
        title: t('pages.receivables.receipt.title'),
        description: t('common.messages.fillRequired'),
        variant: 'destructive',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await receivablesService.receive(receivable.id, {
        value: parseFloat(form.value),
        account: parseInt(form.account),
        date: form.date,
        notes: form.notes,
        scheduled,
      });
      toast({
        title: scheduled
          ? t('pages.receivables.receipt.scheduledSuccess')
          : t('pages.receivables.receipt.success'),
        description: scheduled
          ? t('pages.receivables.receipt.scheduledSuccessDesc', { date: form.date })
          : t('pages.receivables.receipt.successDesc'),
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

  const handleClose = (open: boolean) => {
    if (!open) {
      setScheduled(false);
      onClose();
    }
  };

  return (
    <Dialog open={!!receivable} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.receivables.receipt.title')}</DialogTitle>
          <DialogDescription>
            {receivable?.description} — {t('pages.receivables.remainingBalance')}{' '}
            {formatCurrency(remaining)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          <div className="flex overflow-hidden rounded-lg border">
            <button
              type="button"
              onClick={() => {
                setScheduled(false);
                setForm((f) => ({ ...f, date: today }));
              }}
              className={`gap-xs py-sm flex flex-1 items-center justify-center text-sm transition-colors ${
                !scheduled
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />
              {t('pages.receivables.receipt.receiveNow')}
            </button>
            <button
              type="button"
              onClick={() => setScheduled(true)}
              className={`gap-xs py-sm flex flex-1 items-center justify-center border-l text-sm transition-colors ${
                scheduled
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {t('pages.receivables.receipt.schedule')}
            </button>
          </div>

          <div className="space-y-xs">
            <Label>{t('pages.receivables.receipt.value')} *</Label>
            <Input
              type="number"
              step="0.01"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-xs">
            <Label>{t('pages.receivables.receipt.account')} *</Label>
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
            <Label>
              {scheduled
                ? t('pages.receivables.receipt.scheduledDate')
                : t('pages.receivables.receipt.date')}{' '}
              *
            </Label>
            <DatePicker
              value={form.date}
              minDate={scheduled ? new Date(now + 86400000) : undefined}
              onChange={(date) =>
                setForm((f) => ({ ...f, date: date ? formatLocalDate(date) : '' }))
              }
            />
          </div>
          <div className="space-y-xs">
            <Label>{t('pages.receivables.receipt.notes')}</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t('common.fields.notes')}
            />
          </div>

          {(isFutureDate || scheduled) && form.account && form.value && (
            <div className="border-success/30 bg-success/10 p-sm text-success flex items-start gap-2 rounded-md border text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {isLoadingProjected
                  ? t('common.balance.loadingProjected')
                  : projectedBalance !== null
                    ? t('common.balance.projectedOn', {
                        date: form.date,
                        balance: formatCurrency(projectedBalance),
                      })
                    : t('common.balance.projectedUnavailable')}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting
                ? t('common.actions.saving')
                : scheduled
                  ? t('pages.receivables.receipt.scheduleBtn')
                  : t('pages.receivables.receipt.submit')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
