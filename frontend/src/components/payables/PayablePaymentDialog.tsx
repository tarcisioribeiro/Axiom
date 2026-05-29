/* eslint-disable max-lines */
import { AlertCircle, CalendarClock, CreditCard } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
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
import { getAccountBalanceInfo } from '@/lib/helpers';
import { formatLocalDate } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
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

  const remaining = payable
    ? parseFloat(payable.value) - parseFloat(payable.paid_value)
    : 0;

  const isFutureDate = form.date > today;

  const balanceInfo = useMemo(() => {
    if (scheduled || isFutureDate) return null;
    const amount = parseFloat(form.value) || 0;
    if (!form.account || amount <= 0) return null;
    const account = accounts.find((a) => String(a.id) === form.account);
    if (!account) return null;
    return getAccountBalanceInfo(account, amount);
  }, [form.account, form.value, accounts, scheduled, isFutureDate]);

  const futureBalanceInfo = useMemo(() => {
    if (!isFutureDate && !scheduled) return null;
    const amount = parseFloat(form.value) || 0;
    if (!form.account || amount <= 0 || projectedBalance === null) return null;
    const account = accounts.find((a) => String(a.id) === form.account);
    if (!account) return null;
    const overdraft = parseFloat(account.overdraft_limit ?? '0');
    const proj = parseFloat(projectedBalance);
    const available = proj + overdraft;
    return {
      balance: proj,
      overdraft,
      available,
      canPay: available >= amount,
      isUsingOverdraft: proj < amount && available >= amount,
    };
  }, [form.account, form.value, projectedBalance, accounts, isFutureDate, scheduled]);

  const isValueExceedsRemaining = parseFloat(form.value) > remaining;

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
    if (!payable) return;
    if (!form.value || !form.account || !form.date) {
      toast({
        title: t('pages.payables.payment.title'),
        description: t('common.messages.fillRequired'),
        variant: 'destructive',
      });
      return;
    }
    if (isValueExceedsRemaining) {
      toast({
        title: t('pages.payables.payment.title'),
        description: t('common.balance.insufficientEvenWithOverdraft', {
          available: formatCurrency(remaining.toFixed(2)),
        }),
        variant: 'destructive',
      });
      return;
    }
    if (balanceInfo && !balanceInfo.canPay) {
      toast({
        title: t('common.balance.insufficient'),
        description: t('common.balance.insufficientEvenWithOverdraft', {
          available: formatCurrency(balanceInfo.available.toFixed(2)),
        }),
        variant: 'destructive',
      });
      return;
    }
    if (futureBalanceInfo && !futureBalanceInfo.canPay) {
      toast({
        title: t('common.balance.insufficient'),
        description: t('common.balance.insufficientEvenWithOverdraft', {
          available: formatCurrency(futureBalanceInfo.available.toFixed(2)),
        }),
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
        scheduled,
      });
      toast({
        title: scheduled
          ? t('pages.payables.payment.scheduledSuccess')
          : t('pages.payables.payment.success'),
        description: scheduled
          ? t('pages.payables.payment.scheduledSuccessDesc', { date: form.date })
          : t('pages.payables.payment.successDesc'),
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
    <Dialog open={!!payable} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.payables.payment.title')}</DialogTitle>
          <DialogDescription>
            {payable?.description} — {t('pages.payables.remainingBalance')}{' '}
            {formatCurrency(remaining)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          {/* Modo: Pagar agora / Agendar */}
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
              <CreditCard className="h-3.5 w-3.5" />
              {t('pages.payables.payment.payNow')}
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
              {t('pages.payables.payment.schedule')}
            </button>
          </div>

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
            <Label>
              {scheduled
                ? t('pages.payables.payment.scheduledDate')
                : t('pages.payables.payment.date')}{' '}
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
            <Label>{t('pages.payables.payment.notes')}</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t('common.fields.notes')}
            />
          </div>

          {/* Valor excede restante */}
          {isValueExceedsRemaining && parseFloat(form.value) > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-sm text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {t('pages.payables.payment.exceedsRemaining', {
                  remaining: formatCurrency(remaining.toFixed(2)),
                })}
              </p>
            </div>
          )}

          {/* Saldo projetado ou alerta para data futura / agendamento */}
          {(isFutureDate || scheduled) && form.account && form.value && (
            <div
              className={`flex items-start gap-2 rounded-md border p-sm text-sm ${
                futureBalanceInfo && !futureBalanceInfo.canPay
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : futureBalanceInfo?.isUsingOverdraft
                    ? 'border-warning/30 bg-warning/10 text-warning'
                    : 'border-info/30 bg-info/10 text-info'
              }`}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {isLoadingProjected
                  ? t('common.balance.loadingProjected')
                  : futureBalanceInfo && !futureBalanceInfo.canPay
                    ? t('common.balance.insufficientEvenWithOverdraft', {
                        available: formatCurrency(
                          futureBalanceInfo.available.toFixed(2)
                        ),
                      })
                    : futureBalanceInfo?.isUsingOverdraft
                      ? t('common.balance.overdraftWarningDesc', {
                          balance: formatCurrency(futureBalanceInfo.balance.toFixed(2)),
                          overdraft: formatCurrency(
                            futureBalanceInfo.overdraft.toFixed(2)
                          ),
                          total: formatCurrency(futureBalanceInfo.available.toFixed(2)),
                        })
                      : projectedBalance !== null
                        ? t('common.balance.projectedOn', {
                            date: form.date,
                            balance: formatCurrency(projectedBalance),
                          })
                        : t('common.balance.projectedUnavailable')}
              </p>
            </div>
          )}

          {/* Alerta de saldo insuficiente (pagamento imediato) */}
          {balanceInfo && parseFloat(form.value) > 0 && (
            <div
              className={`flex items-start gap-2 rounded-md border p-sm text-sm ${
                !balanceInfo.canPay
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-warning/30 bg-warning/10 text-warning'
              }`}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {!balanceInfo.canPay
                  ? t('common.balance.insufficientEvenWithOverdraft', {
                      available: formatCurrency(balanceInfo.available.toFixed(2)),
                    })
                  : t('common.balance.overdraftWarningDesc', {
                      balance: formatCurrency(balanceInfo.balance.toFixed(2)),
                      overdraft: formatCurrency(balanceInfo.overdraft.toFixed(2)),
                      total: formatCurrency(balanceInfo.available.toFixed(2)),
                    })}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={
                isSubmitting ||
                isValueExceedsRemaining ||
                (!scheduled && !!balanceInfo && !balanceInfo.canPay) ||
                ((isFutureDate || scheduled) &&
                  !!futureBalanceInfo &&
                  !futureBalanceInfo.canPay)
              }
            >
              {isSubmitting
                ? t('common.actions.saving')
                : scheduled
                  ? t('pages.payables.payment.scheduleBtn')
                  : t('pages.payables.payment.submit')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
