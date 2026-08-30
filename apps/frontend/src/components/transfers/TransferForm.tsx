/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  Loader2,
  Wallet,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import type { IconComponent } from '@/types/icon';

interface TransferFormProps {
  transfer?: Transfer;
  accounts: Account[];
  onSubmit: (data: TransferFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const TRANSFER_TYPE_ICONS: Record<string, IconComponent> = {
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
  const { register, handleSubmit, setValue, control } = useForm<TransferFormData>({
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

  const watchedOriginAccount = useWatch({ control, name: 'origin_account' });
  const watchedDestinyAccount = useWatch({ control, name: 'destiny_account' });
  const watchedTransfered = useWatch({ control, name: 'transfered' });
  const watchedValue = useWatch({ control, name: 'value' });
  const watchedDate = useWatch({ control, name: 'date' });
  const watchedHorary = useWatch({ control, name: 'horary' });
  const watchedCategoryRaw = useWatch({ control, name: 'category' });
  const watchedCategory = watchedCategoryRaw || 'pix';
  const today = formatLocalDate(new Date());
  const isFutureDate = watchedDate > today;

  const { data: projectedBalance = null, isLoading: isLoadingProjected } = useQuery({
    queryKey: ['projected-balance', watchedOriginAccount, watchedDate],
    queryFn: async () => {
      try {
        const data = await accountsService.getProjectedBalance(
          watchedOriginAccount,
          watchedDate
        );
        return data.projected_balance;
      } catch {
        return null;
      }
    },
    enabled: !!watchedOriginAccount && !!watchedDate && !!watchedValue && isFutureDate,
  });

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
    if (!transfer && accounts.length > 0) {
      const currentOrigin = watchedOriginAccount;
      const currentDestiny = watchedDestinyAccount;
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
      if (watchedDestinyAccount === watchedOriginAccount) {
        const newDestiny = accounts.find((a) => a.id !== watchedOriginAccount);
        if (newDestiny) setValue('destiny_account', newDestiny.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedOriginAccount]);

  const handleSwapAccounts = () => {
    const origin = watchedOriginAccount;
    const destiny = watchedDestinyAccount;
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
          <Label className="gap-xs flex items-center">
            <FileText className="text-muted-foreground h-3.5 w-3.5" />
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
        <div className="gap-sm grid grid-cols-2 sm:grid-cols-4">
          {Object.entries(TRANSLATIONS.transferTypes).map(([k, v]) => {
            const Icon = TRANSFER_TYPE_ICONS[k] ?? ArrowLeftRight;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setValue('category', k)}
                className={`p-sm flex flex-col items-center gap-1 rounded-lg border text-sm font-medium transition ${
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
      <div className="border-border/50 bg-muted/20 p-md rounded-lg border">
        <p className="mb-sm text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {t('pages.transfers.form.flowLabel')}
        </p>
        <div className="gap-sm flex items-center">
          <div className="space-y-xs flex-1">
            <p className="text-muted-foreground text-xs">
              {t('pages.transfers.form.flowFrom')}
            </p>
            <Select
              value={watchedOriginAccount?.toString() || ''}
              onValueChange={(v) => setValue('origin_account', parseInt(v))}
            >
              <SelectTrigger className="py-sm h-auto">
                <SelectValue
                  placeholder={t('pages.transfers.form.originAccountPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    <span>{a.account_name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
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

          <div className="gap-xs flex flex-col items-center">
            <button
              type="button"
              title={t('pages.transfers.form.swapAccounts')}
              onClick={handleSwapAccounts}
              className="border-border/70 bg-background text-muted-foreground hover:border-primary/50 hover:text-primary rounded-full border p-1.5 transition-colors"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            {formattedValue && (
              <span className="text-primary text-xs font-semibold">
                {formattedValue}
              </span>
            )}
          </div>

          <div className="space-y-xs flex-1">
            <p className="text-muted-foreground text-xs">
              {t('pages.transfers.form.flowTo')}
            </p>
            <Select
              value={watchedDestinyAccount?.toString() || ''}
              onValueChange={(v) => setValue('destiny_account', parseInt(v))}
            >
              <SelectTrigger className="py-sm h-auto">
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
              <p className="text-muted-foreground text-xs">
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
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Wallet className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.transfers.form.valueLabel')}
            </Label>
            <CurrencyInput
              value={watchedValue}
              onChange={(e) => setValue('value', parseFloat(e.target.value) || 0)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Wallet className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.transfers.form.transferedLabel')}
            </Label>
            <StatusToggle
              value={watchedTransfered ? 'true' : 'false'}
              options={[
                {
                  value: 'false',
                  label: t('common.status.pending'),
                },
                {
                  value: 'true',
                  label: t('common.status.completed'),
                  accentColor: 'success',
                },
              ]}
              onChange={(v) => setValue('transfered', v === 'true')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.transfers.form.dateLabel')}
            </Label>
            <DatePicker
              value={watchedDate}
              onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
              placeholder={t('pages.transfers.form.datePlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Clock className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.transfers.form.timeLabel')}
            </Label>
            <TimePicker
              value={watchedHorary}
              onChange={(t) => setValue('horary', t ?? '')}
              disabled={isLoading}
            />
          </div>
        </div>
      </FormSection>

      {/* Alertas de saldo */}
      {isFutureDate && watchedOriginAccount && watchedValue > 0 && (
        <div
          className={`p-sm flex items-start gap-2 rounded-md border text-sm ${
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
          className={`p-sm flex items-start gap-2 rounded-md border text-sm ${
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

      <div className="gap-sm pt-md flex justify-end border-t">
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
          {isLoading ? (
            <>
              <Loader2 className="mr-xs h-4 w-4 animate-spin" />
              {t('common.actions.saving')}
            </>
          ) : transfer ? (
            t('common.actions.update')
          ) : (
            t('common.actions.create')
          )}
        </Button>
      </div>
    </form>
  );
};
