/* eslint-disable max-lines, react-hooks/incompatible-library */
import {
  BadgePercent,
  CalendarDays,
  CreditCard,
  DollarSign,
  Hash,
  Lock,
  Settings,
  User,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { TRANSLATIONS } from '@/config/constants';
import { formatLocalDate } from '@/lib/utils';
import type {
  Account,
  CreditCard as CreditCardType,
  CreditCardFormData,
} from '@/types';

const BRAND_COLORS: Record<string, string> = {
  VSA: 'from-blue-600 to-blue-800',
  MSC: 'from-red-600 to-orange-700',
  ELO: 'from-yellow-500 to-yellow-700',
  EXP: 'from-teal-500 to-teal-800',
  HCD: 'from-pink-600 to-rose-800',
  DIN: 'from-slate-500 to-slate-800',
};

const BRAND_ICONS: Record<string, string> = {
  VSA: 'VISA',
  MSC: 'MC',
  ELO: 'ELO',
  EXP: 'AMEX',
  HCD: 'HIPER',
  DIN: 'DINERS',
};

interface CreditCardFormProps {
  creditCard?: CreditCardType;
  accounts: Account[];
  onSubmit: (data: CreditCardFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const CreditCardForm: React.FC<CreditCardFormProps> = ({
  creditCard,
  accounts,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'card' | 'settings'>('card');

  const { register, handleSubmit, setValue, watch } = useForm<CreditCardFormData>({
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
                <p className="text-sm font-semibold uppercase tracking-wider">
                  {watchedOnCardName || '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-60">VALIDADE</p>
                <p className="font-mono text-sm">
                  {watchedValidationDate
                    ? watchedValidationDate.substring(0, 7)
                    : '••/••'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
      </div>

      {/* Tabs */}
      <div className="flex rounded-md border border-border/70 bg-muted/30 p-0.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex flex-1 items-center justify-center gap-xs rounded px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
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
        <FormSection title={t('pages.creditCards.form.tabCardData')} icon={CreditCard}>
          <div className="grid grid-cols-1 gap-md md:grid-cols-2">
            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.creditCards.form.nameLabel')}
              </Label>
              <Input
                {...register('name', { required: true })}
                placeholder={t('pages.creditCards.form.namePlaceholder')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.creditCards.form.onCardNameLabel')}
              </Label>
              <Input
                {...register('on_card_name', { required: true })}
                placeholder={t('pages.creditCards.form.onCardNamePlaceholder')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.creditCards.form.flagLabel')}
              </Label>
              <div className="grid grid-cols-3 gap-xs">
                {Object.entries(TRANSLATIONS.cardBrands).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setValue('flag', k)}
                    className={`rounded border p-xs text-xs font-semibold transition-all ${
                      watchedFlag === k
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
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
              {creditCard && (
                <p className="text-xs text-muted-foreground">
                  {t('pages.creditCards.form.cardNumberHiddenHint')}
                </p>
              )}
            </div>

            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
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
              <Label className="flex items-center gap-xs">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
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
      )}

      {/* Tab: Configurações */}
      {activeTab === 'settings' && (
        <FormSection title={t('pages.creditCards.form.tabSettings')} icon={Settings}>
          <div className="grid grid-cols-1 gap-md md:grid-cols-2">
            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
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
              <Label className="flex items-center gap-xs">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.creditCards.form.maxLimitLabel')}
              </Label>
              <CurrencyInput
                value={watchedMaxLimit}
                onChange={(e) => setValue('max_limit', parseFloat(e.target.value) || 0)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
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
              <Label className="flex items-center gap-xs">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.creditCards.form.dueDayLabel')}
              </Label>
              <Input
                type="number"
                min="1"
                max="31"
                {...register('due_day', { required: true, valueAsNumber: true })}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.creditCards.form.closingDayLabel')}
              </Label>
              <Input
                type="number"
                min="1"
                max="31"
                {...register('closing_day', { required: true, valueAsNumber: true })}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.creditCards.form.interestRateLabel')}
              </Label>
              <Input
                type="number"
                step="0.01"
                {...register('interest_rate', { valueAsNumber: true })}
                placeholder="0.00"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
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

            <div className="space-y-sm md:col-span-2">
              <Label className="flex items-center gap-xs">
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.creditCards.form.notesLabel')}
              </Label>
              <Textarea
                {...register('notes')}
                placeholder={t('pages.creditCards.form.notesPlaceholder')}
                disabled={isLoading}
                rows={3}
              />
            </div>
          </div>
        </FormSection>
      )}

      <div className="flex justify-end gap-sm border-t pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
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
