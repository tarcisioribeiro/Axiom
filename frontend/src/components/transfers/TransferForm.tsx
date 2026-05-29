/* eslint-disable max-lines */
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  Wallet,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusToggle } from '@/components/ui/status-toggle';
import { TimePicker } from '@/components/ui/time-picker';
import { TRANSLATIONS } from '@/config/constants';
import { formatCurrency } from '@/lib/formatters';
import { getAccountBalanceInfo } from '@/lib/helpers';
import { formatLocalDate } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import type { Account, Transfer, TransferFormData } from '@/types';

interface TransferFormProps {
  transfer?: Transfer;
  accounts: Account[];
  onSubmit: (data: TransferFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const TRANSFER_TYPE_ICONS: Record<string, LucideIcon> = {
  pix: Zap,
  ted: Building2,
  doc: FileText,
  internal: ArrowLeftRight,
};

export const TransferForm: React.FC<TransferFormProps> = ({
  transfer,
  accounts,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const { register, handleSubmit, setValue, watch } = useForm<TransferFormData>({
    defaultValues: transfer
      ? {
          description: transfer.description,
          value: parseFloat(transfer.value),
          date: transfer.date,
          horary: transfer.horary,
          category: transfer.category,
          transfered: transfer.transfered,
          origin_account: transfer.origin_account,
          destiny_account: transfer.destiny_account,
        }
      : {
          date: formatLocalDate(new Date()),
          horary: new Date().toTimeString().split(' ')[0].substring(0, 5),
          category: 'pix',
          transfered: false,
          origin_account: undefined,
          destiny_account: undefined,
        },
  });

  const watchedOriginAccount = watch('origin_account');
  const watchedDestinyAccount = watch('destiny_account');
  const watchedTransfered = watch('transfered');
  const watchedValue = watch('value');
  const watchedDate = watch('date');
  const watchedCategory = watch('category') || 'pix';
  const today = formatLocalDate(new Date());
  const isFutureDate = watchedDate > today;

  const [projectedBalance, setProjectedBalance] = useState<string | null>(null);
  const [isLoadingProjected, setIsLoadingProjected] = useState(false);

  const balanceInfo = useMemo(() => {
    if (isFutureDate) return null;
    if (!watchedOriginAccount || !watchedValue || watchedValue <= 0) return null;
    const account = accounts.find((a) => a.id === watchedOriginAccount);
    if (!account) return null;
    return getAccountBalanceInfo(account, watchedValue);
  }, [watchedOriginAccount, watchedValue, accounts, isFutureDate]);

  const futureBalanceInfo = useMemo(() => {
    if (!isFutureDate || !watchedValue || watchedValue <= 0 || !watchedOriginAccount)
      return null;
    const account = accounts.find((a) => a.id === watchedOriginAccount);
    if (!account) return null;
    const overdraft = parseFloat(account.overdraft_limit ?? '0');
    if (watchedTransfered) return getAccountBalanceInfo(account, watchedValue);
    if (projectedBalance === null) return null;
    const proj = parseFloat(projectedBalance);
    const available = proj + overdraft;
    return {
      balance: proj,
      overdraft,
      available,
      canPay: available >= watchedValue,
      isUsingOverdraft: proj < watchedValue && available >= watchedValue,
    };
  }, [
    isFutureDate,
    watchedValue,
    watchedOriginAccount,
    watchedTransfered,
    projectedBalance,
    accounts,
  ]);

  useEffect(() => {
    if (!watchedOriginAccount || !watchedDate || !watchedValue || !isFutureDate) {
      setProjectedBalance(null);
      return;
    }
    setIsLoadingProjected(true);
    accountsService
      .getProjectedBalance(watchedOriginAccount, watchedDate)
      .then((data) => setProjectedBalance(data.projected_balance))
      .catch(() => setProjectedBalance(null))
      .finally(() => setIsLoadingProjected(false));
  }, [watchedOriginAccount, watchedDate, watchedValue, isFutureDate]);

  useEffect(() => {
    if (!transfer && accounts.length > 0) {
      const currentOrigin = watch('origin_account');
      const currentDestiny = watch('destiny_account');
      if (!currentOrigin && accounts.length > 0)
        setValue('origin_account', accounts[0].id);
      if (!currentDestiny && accounts.length > 1) {
        const originId = currentOrigin || accounts[0].id;
        const destinyAccount = accounts.find((a) => a.id !== originId);
        if (destinyAccount) setValue('destiny_account', destinyAccount.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transfer, accounts.length]);

  useEffect(() => {
    if (!transfer && watchedOriginAccount && accounts.length > 1) {
      const currentDestiny = watch('destiny_account');
      if (currentDestiny === watchedOriginAccount) {
        const newDestiny = accounts.find((a) => a.id !== watchedOriginAccount);
        if (newDestiny) setValue('destiny_account', newDestiny.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedOriginAccount]);

  const handleSwapAccounts = () => {
    const origin = watch('origin_account');
    const destiny = watch('destiny_account');
    setValue('origin_account', destiny);
    setValue('destiny_account', origin);
  };

  const originAccount = accounts.find((a) => a.id === watchedOriginAccount);
  const destinyAccount = accounts.find((a) => a.id === watchedDestinyAccount);
  const formattedValue =
    (watchedValue ?? 0) > 0
      ? (watchedValue ?? 0).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })
      : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      {/* Seção: Informações */}
      <FormSection title={t('common.form.sections.basicInfo')} icon={FileText}>
        <div className="space-y-sm">
          <Label className="flex items-center gap-xs">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            {t('pages.transfers.form.descriptionLabel')}
          </Label>
          <Input
            {...register('description', { required: true })}
            placeholder={t('pages.transfers.form.descriptionPlaceholder')}
            disabled={isLoading}
          />
        </div>
      </FormSection>

      {/* Seção: Tipo de Transferência */}
      <FormSection title={t('pages.transfers.form.typeLabel')} icon={ArrowRight}>
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
          {Object.entries(TRANSLATIONS.transferTypes).map(([k, v]) => {
            const Icon = TRANSFER_TYPE_ICONS[k] ?? ArrowLeftRight;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setValue('category', k)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-sm text-sm font-medium transition-all ${
                  watchedCategory === k
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/70 bg-muted/20 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{v}</span>
              </button>
            );
          })}
        </div>
      </FormSection>

      {/* Widget de Fluxo */}
      <div className="rounded-lg border border-border/50 bg-muted/20 p-md">
        <p className="mb-sm text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('pages.transfers.form.flowLabel')}
        </p>
        <div className="flex items-center gap-sm">
          <div className="flex-1 space-y-xs">
            <p className="text-xs text-muted-foreground">
              {t('pages.transfers.form.flowFrom')}
            </p>
            <Select
              value={watchedOriginAccount?.toString() || ''}
              onValueChange={(v) => setValue('origin_account', parseInt(v))}
            >
              <SelectTrigger className="h-auto py-sm">
                <SelectValue
                  placeholder={t('pages.transfers.form.originAccountPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    <span>{a.account_name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {parseFloat(a.balance).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {originAccount && (
              <p
                className={`text-xs ${parseFloat(originAccount.balance) >= (watchedValue ?? 0) ? 'text-success' : 'text-destructive'}`}
              >
                {parseFloat(originAccount.balance).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-xs">
            <button
              type="button"
              title={t('pages.transfers.form.swapAccounts')}
              onClick={handleSwapAccounts}
              className="rounded-full border border-border/70 bg-background p-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            {formattedValue && (
              <span className="text-xs font-semibold text-primary">
                {formattedValue}
              </span>
            )}
          </div>

          <div className="flex-1 space-y-xs">
            <p className="text-xs text-muted-foreground">
              {t('pages.transfers.form.flowTo')}
            </p>
            <Select
              value={watchedDestinyAccount?.toString() || ''}
              onValueChange={(v) => setValue('destiny_account', parseInt(v))}
            >
              <SelectTrigger className="h-auto py-sm">
                <SelectValue
                  placeholder={t('pages.transfers.form.destinyAccountPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.id !== watchedOriginAccount)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      {a.account_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {destinyAccount && (
              <p className="text-xs text-muted-foreground">
                {parseFloat(destinyAccount.balance).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Seção: Valor & Data */}
      <FormSection title={t('common.form.sections.values')} icon={Wallet}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.transfers.form.valueLabel')}
            </Label>
            <CurrencyInput
              value={watchedValue}
              onChange={(e) => setValue('value', parseFloat(e.target.value) || 0)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.transfers.form.transferedLabel')}
            </Label>
            <StatusToggle
              value={watchedTransfered ? 'true' : 'false'}
              options={[
                {
                  value: 'false',
                  label: t('common.status.pending'),
                  activeClass: 'bg-background text-foreground shadow-sm',
                },
                {
                  value: 'true',
                  label: t('common.status.completed'),
                  activeClass: 'bg-success/15 text-success shadow-sm',
                },
              ]}
              onChange={(v) => setValue('transfered', v === 'true')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.transfers.form.dateLabel')}
            </Label>
            <DatePicker
              value={watch('date')}
              onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
              placeholder={t('pages.transfers.form.datePlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.transfers.form.timeLabel')}
            </Label>
            <TimePicker
              value={watch('horary')}
              onChange={(t) => setValue('horary', t ?? '')}
              disabled={isLoading}
            />
          </div>
        </div>
      </FormSection>

      {/* Alertas de saldo */}
      {isFutureDate && watchedOriginAccount && watchedValue > 0 && (
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
                    available: formatCurrency(futureBalanceInfo.available.toFixed(2)),
                  })
                : futureBalanceInfo?.isUsingOverdraft
                  ? t('common.balance.overdraftWarningDesc', {
                      balance: formatCurrency(futureBalanceInfo.balance.toFixed(2)),
                      overdraft: formatCurrency(futureBalanceInfo.overdraft.toFixed(2)),
                      total: formatCurrency(futureBalanceInfo.available.toFixed(2)),
                    })
                  : projectedBalance !== null
                    ? t('common.balance.projectedOn', {
                        date: watchedDate,
                        balance: formatCurrency(projectedBalance),
                      })
                    : t('common.balance.projectedUnavailable')}
          </p>
        </div>
      )}
      {balanceInfo && watchedValue > 0 && (
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

      <div className="flex justify-end gap-sm border-t pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={
            isLoading ||
            (!!balanceInfo && !balanceInfo.canPay) ||
            (!!futureBalanceInfo && !futureBalanceInfo.canPay)
          }
        >
          {isLoading
            ? t('common.actions.saving')
            : transfer
              ? t('common.actions.update')
              : t('common.actions.create')}
        </Button>
      </div>
    </form>
  );
};
