/* eslint-disable max-lines, react-hooks/incompatible-library */
import { useReducedMotion } from 'framer-motion';
import {
  BadgePercent,
  CalendarDays,
  CreditCard,
  DollarSign,
  Hash,
  Lock,
  Loader2,
  Settings,
  User,
  Wallet,
  Save,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { BRAND_COLORS, BRAND_ICONS } from '@/components/credit-cards/card-brands';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import { DecimalInput } from '@/components/ui/decimal-input';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TabTransition } from '@/components/ui/tabs';
import { TRANSLATIONS } from '@/config/constants';
import { formatLocalDate } from '@/lib/utils';
import type {
  Account,
  CreditCard as CreditCardType,
  CreditCardFormData,
} from '@/types';

interface CreditCardFormProps {
  creditCard?: CreditCardType;
  accounts: Account[];
  onSubmit: (data: CreditCardFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** Omite o card de pré-visualização (quando o container já exibe o cartão). */
  hidePreview?: boolean;
}

export const CreditCardForm: React.FC<CreditCardFormProps> = ({
  creditCard,
  accounts,
  onSubmit,
  onCancel,
  isLoading = false,
  hidePreview = false,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'card' | 'settings'>('card');
  // 1 = aba Configurações (entra pela direita), -1 = Dados do cartão (entra pela esquerda)
  const [tabDirection, setTabDirection] = useState(0);
  const reducedMotion = useReducedMotion();

  const selectTab = (id: 'card' | 'settings') => {
    if (id === activeTab) return;
    setTabDirection(id === 'settings' ? 1 : -1);
    setActiveTab(id);
  };

  const { control, register, handleSubmit, setValue, watch } =
    useForm<CreditCardFormData>({
      defaultValues: creditCard
        ? {
            name: creditCard.name,
            on_card_name: creditCard.on_card_name,
            card_number: '',
            flag: creditCard.flag,
            security_code: '',
            validation_date: creditCard.validation_date,
            credit_limit: parseFloat(creditCard.credit_limit),
            max_limit: parseFloat(creditCard.max_limit),
            due_day: creditCard.due_day,
            closing_day: creditCard.closing_day,
            associated_account: creditCard.associated_account,
            is_active: creditCard.is_active,
            interest_rate: creditCard.interest_rate
              ? parseFloat(creditCard.interest_rate)
              : undefined,
            annual_fee: creditCard.annual_fee
              ? parseFloat(creditCard.annual_fee)
              : undefined,
            owner: creditCard.owner,
            notes: creditCard.notes,
          }
        : {
            credit_limit: 0,
            max_limit: 0,
            due_day: 10,
            closing_day: 5,
            is_active: true,
            validation_date: formatLocalDate(new Date()),
          },
    });

  const watchedFlag = watch('flag') || '';
  const watchedName = watch('name') || '';
  const watchedOnCardName = watch('on_card_name') || '';
  const watchedCardNumber = watch('card_number') || '';
  const watchedValidationDate = watch('validation_date') || '';
  const watchedCreditLimit = watch('credit_limit') ?? 0;
  const watchedMaxLimit = watch('max_limit') ?? 0;

  const maskedCardNumber = watchedCardNumber
    ? watchedCardNumber.replace(/\d{4}(?=\d)/g, '**** ').trim()
    : creditCard
      ? '**** **** **** ****'
      : '•••• •••• •••• ••••';

  const brandGradient = BRAND_COLORS[watchedFlag] || 'from-slate-600 to-slate-900';
  const brandLabel = BRAND_ICONS[watchedFlag] || '';

  const tabs = [
    {
      id: 'card' as const,
      label: t('pages.creditCards.form.tabCardData'),
      icon: CreditCard,
    },
    {
      id: 'settings' as const,
      label: t('pages.creditCards.form.tabSettings'),
      icon: Settings,
    },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      {/* Preview do Cartão */}
      {!hidePreview && (
        <div
          className={`relative h-36 w-full overflow-hidden rounded-xl bg-gradient-to-br ${brandGradient} p-md text-white shadow-lg`}
        >
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium opacity-70">
                  {watchedName || t('pages.creditCards.form.namePlaceholder')}
                </p>
              </div>
              {brandLabel && (
                <span className="text-xs font-bold tracking-widest opacity-90">
                  {brandLabel}
                </span>
              )}
            </div>
            <div className="space-y-xs">
              <p className="font-mono text-sm tracking-widest opacity-90">
                {maskedCardNumber}
              </p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs opacity-60">{t('common.fields.name')}</p>
                  <p className="text-sm font-semibold tracking-wider uppercase">
                    {watchedOnCardName || '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-60">VALIDADE</p>
                  <p className="font-mono text-sm">
                    {watchedValidationDate
                      ? `${watchedValidationDate.substring(5, 7)}/${watchedValidationDate.substring(2, 4)}`
                      : '••/••'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/5" />
          <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
        </div>
      )}

      {/* Tabs */}
      <div className="border-border/70 bg-muted/30 flex rounded-md border p-0.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectTab(id)}
            className={`gap-xs duration-fast flex flex-1 items-center justify-center rounded px-3 py-1.5 text-sm font-medium transition ${
              activeTab === id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Dados do Cartão */}
      {activeTab === 'card' && (
        <TabTransition
          key="card"
          {...(!reducedMotion && {
            initial: { opacity: 0, x: -24 * tabDirection },
            animate: { opacity: 1, x: 0 },
          })}
        >
          <FormSection
            title={t('pages.creditCards.form.tabCardData')}
            icon={CreditCard}
          >
            <div className="gap-md grid grid-cols-1 md:grid-cols-2">
              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <CreditCard className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.creditCards.form.nameLabel')}
                </Label>
                <Input
                  {...register('name', { required: true })}
                  placeholder={t('pages.creditCards.form.namePlaceholder')}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <User className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.creditCards.form.onCardNameLabel')}
                </Label>
                <Input
                  {...register('on_card_name', { required: true })}
                  placeholder={t('pages.creditCards.form.onCardNamePlaceholder')}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <CreditCard className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.creditCards.form.flagLabel')}
                </Label>
                <Select
                  value={watchedFlag || undefined}
                  onValueChange={(v) => setValue('flag', v)}
                  disabled={isLoading}
                >
                  <SelectTrigger aria-label={t('pages.creditCards.form.flagLabel')}>
                    <SelectValue placeholder={t('common.actions.select')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRANSLATIONS.cardBrands).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <Hash className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.creditCards.form.cardNumberLabel')}
                </Label>
                <Input
                  {...register('card_number', { required: !creditCard })}
                  placeholder={
                    creditCard
                      ? t('pages.creditCards.form.cardNumberHiddenHint')
                      : '0000 0000 0000 0000'
                  }
                  maxLength={16}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <Lock className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.creditCards.form.cvvLabel')}
                </Label>
                <Input
                  {...register('security_code', { required: !creditCard })}
                  placeholder="•••"
                  maxLength={4}
                  type="password"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.creditCards.form.validationDateLabel')}
                </Label>
                <DatePicker
                  value={watch('validation_date')}
                  onChange={(date) =>
                    setValue('validation_date', date ? formatLocalDate(date) : '')
                  }
                  placeholder={t('pages.creditCards.form.validationDatePlaceholder')}
                  disabled={isLoading}
                />
              </div>
            </div>
          </FormSection>
        </TabTransition>
      )}

      {/* Tab: Configurações */}
      {activeTab === 'settings' && (
        <TabTransition
          key="settings"
          {...(!reducedMotion && {
            initial: { opacity: 0, x: 24 * tabDirection },
            animate: { opacity: 1, x: 0 },
          })}
        >
          <FormSection title={t('pages.creditCards.form.tabSettings')} icon={Settings}>
            <div className="gap-md grid grid-cols-1 md:grid-cols-2">
              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <DollarSign className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.creditCards.form.creditLimitLabel')}
                </Label>
                <CurrencyInput
                  value={watchedCreditLimit}
                  onChange={(e) =>
                    setValue('credit_limit', parseFloat(e.target.value) || 0)
                  }
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <DollarSign className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.creditCards.form.maxLimitLabel')}
                </Label>
                <CurrencyInput
                  value={watchedMaxLimit}
                  onChange={(e) =>
                    setValue('max_limit', parseFloat(e.target.value) || 0)
                  }
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <Wallet className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.creditCards.form.associatedAccountLabel')}
                </Label>
                <Select
                  value={watch('associated_account')?.toString()}
                  onValueChange={(v) => setValue('associated_account', parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.actions.select')} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>
                        {a.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <BadgePercent className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.creditCards.form.interestRateLabel')}
                </Label>
                <Controller
                  control={control}
                  name="interest_rate"
                  render={({ field }) => (
                    <DecimalInput
                      unit="%"
                      placeholder="0,00"
                      disabled={isLoading}
                      aria-label={t('pages.creditCards.form.interestRateLabel')}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="gap-md grid grid-cols-1 md:col-span-2 md:grid-cols-3">
                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center">
                    <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.creditCards.form.closingDayLabel')}
                  </Label>
                  <Controller
                    control={control}
                    name="closing_day"
                    rules={{ required: true }}
                    render={({ field }) => (
                      <NumberStepper
                        disabled={isLoading}
                        min={1}
                        max={31}
                        aria-label={t('pages.creditCards.form.closingDayLabel')}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center">
                    <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.creditCards.form.dueDayLabel')}
                  </Label>
                  <Controller
                    control={control}
                    name="due_day"
                    rules={{ required: true }}
                    render={({ field }) => (
                      <NumberStepper
                        disabled={isLoading}
                        min={1}
                        max={31}
                        aria-label={t('pages.creditCards.form.dueDayLabel')}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center">
                    <DollarSign className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.creditCards.form.annualFeeLabel')}
                  </Label>
                  <CurrencyInput
                    value={watch('annual_fee') ?? 0}
                    onChange={(e) =>
                      setValue('annual_fee', parseFloat(e.target.value) || 0)
                    }
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          </FormSection>
        </TabTransition>
      )}

      <div className="dialog-footer gap-sm pt-md flex justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isLoading
            ? t('common.actions.saving')
            : creditCard
              ? t('common.actions.update')
              : t('common.actions.create')}
        </Button>
      </div>
    </form>
  );
};
