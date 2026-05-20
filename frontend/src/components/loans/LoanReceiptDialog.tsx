import { AlertCircle, CalendarClock, Wallet } from 'lucide-react';
import { useState, useEffect } from 'react';
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
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { loanInstallmentsService } from '@/services/loan-installments-service';
import type { Account, Loan } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface LoanReceiptDialogProps {
  loan: Loan | null;
  accounts: Account[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function LoanReceiptDialog({
  loan,
  accounts,
  onClose,
  onSuccess,
}: LoanReceiptDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    value: '',
    account: '',
    date: today,
    notes: '',
  });
  const [scheduled, setScheduled] = useState(false);
  const [projectedBalance, setProjectedBalance] = useState<string | null>(null);
  const [isLoadingProjected, setIsLoadingProjected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remaining = loan ? parseFloat(loan.value) - parseFloat(loan.payed_value) : 0;
  const isFutureDate = form.date > today;

  useEffect(() => {
    if (!form.account || !form.date || !form.value) {
      setProjectedBalance(null);
      return;
    }
    if (!isFutureDate && !scheduled) {
      setProjectedBalance(null);
      return;
    }
    const accountId = parseInt(form.account);
    setIsLoadingProjected(true);
    accountsService
      .getProjectedBalance(accountId, form.date)
      .then((data) => setProjectedBalance(data.projected_balance))
      .catch(() => setProjectedBalance(null))
      .finally(() => setIsLoadingProjected(false));
  }, [form.account, form.date, form.value, isFutureDate, scheduled]);

  const handleSubmit = async () => {
    if (!loan) return;
    if (!form.value || !form.account || !form.date) {
      toast({
        title: t('pages.loans.receipt.title'),
        description: t('common.messages.fillRequired'),
        variant: 'destructive',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await loanInstallmentsService.receive(loan.id, {
        value: parseFloat(form.value),
        account: parseInt(form.account),
        date: form.date,
        notes: form.notes,
        scheduled,
      });
      toast({
        title: scheduled
          ? t('pages.loans.receipt.scheduledSuccess')
          : t('pages.loans.receipt.success'),
        description: scheduled
          ? t('pages.loans.receipt.scheduledSuccessDesc', { date: form.date })
          : t('pages.loans.receipt.successDesc'),
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
      setProjectedBalance(null);
      onClose();
    }
  };

  return (
    <Dialog open={!!loan} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.loans.receipt.title')}</DialogTitle>
          <DialogDescription>
            {loan?.description} — {t('pages.loans.remainingBalance')}{' '}
            {formatCurrency(remaining)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          {/* Modo: Receber agora / Agendar */}
          <div className="flex overflow-hidden rounded-lg border">
            <button
              type="button"
              onClick={() => {
                setScheduled(false);
                setForm((f) => ({ ...f, date: today }));
              }}
              className={`flex flex-1 items-center justify-center gap-xs py-sm text-sm transition-colors ${
                !scheduled
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />
              {t('pages.loans.receipt.receiveNow')}
            </button>
            <button
              type="button"
              onClick={() => setScheduled(true)}
              className={`flex flex-1 items-center justify-center gap-xs border-l py-sm text-sm transition-colors ${
                scheduled
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {t('pages.loans.receipt.schedule')}
            </button>
          </div>

          <div className="space-y-xs">
            <Label>{t('pages.loans.receipt.value')} *</Label>
            <Input
              type="number"
              step="0.01"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-xs">
            <Label>{t('pages.loans.receipt.account')} *</Label>
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
                ? t('pages.loans.receipt.scheduledDate')
                : t('pages.loans.receipt.date')}{' '}
              *
            </Label>
            <DatePicker
              value={form.date}
              minDate={scheduled ? new Date(Date.now() + 86400000) : undefined}
              onChange={(date) =>
                setForm((f) => ({ ...f, date: date ? formatLocalDate(date) : '' }))
              }
            />
          </div>
          <div className="space-y-xs">
            <Label>{t('pages.loans.receipt.notes')}</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t('common.fields.notes')}
            />
          </div>

          {/* Saldo projetado */}
          {(isFutureDate || scheduled) && form.account && form.value && (
            <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 p-sm text-sm text-success">
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
                  ? t('pages.loans.receipt.scheduleBtn')
                  : t('pages.loans.receipt.submit')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
