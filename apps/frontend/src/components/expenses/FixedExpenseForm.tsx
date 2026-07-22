/* eslint-disable max-lines, react-hooks/incompatible-library */
import { CalendarDays, CreditCard, Store, Tag, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyInput } from '@/components/ui/currency-input';
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
import { EXPENSE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { EXPENSE_CATEGORY_ICONS } from '@/config/icons';
import { logger } from '@/lib/logger';
import { membersService } from '@/services/members-service';
import type {
  CreditCard as CreditCardType,
  FixedExpense,
  FixedExpenseFormData,
  Account,
} from '@/types';

interface Props {
  fixedExpense?: FixedExpense;
  accounts: Account[];
  creditCards: CreditCardType[];
  onSubmit: (data: FixedExpenseFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const FixedExpenseForm = ({
  fixedExpense,
  accounts,
  creditCards,
  onSubmit,
  onCancel,
  isLoading = false,
}: Props) => {
  const [paymentType, setPaymentType] = useState<'account' | 'credit_card'>('account');
  const { t } = useTranslation();

  const { register, handleSubmit, setValue, watch } = useForm<FixedExpenseFormData>({
    defaultValues: {
      description: '',
      default_value: 0,
      due_day: 1,
      category: '',
      account: undefined,
      credit_card: undefined,
      is_active: true,
      allow_value_edit: true,
    },
  });

  useEffect(() => {
    const loadMember = async () => {
      try {
        const member = await membersService.getCurrentUserMember();
        if (!fixedExpense) setValue('member', member.id);
      } catch (error) {
        logger.error('Erro ao carregar membro:', error);
      }
    };
    void loadMember();
  }, [fixedExpense, setValue]);

  useEffect(() => {
    if (fixedExpense) {
      setValue('description', fixedExpense.description);
      setValue('default_value', parseFloat(fixedExpense.default_value));
      setValue('due_day', fixedExpense.due_day);
      setValue('category', fixedExpense.category);
      setValue('merchant', fixedExpense.merchant);
      setValue('payment_method', fixedExpense.payment_method);
      setValue('notes', fixedExpense.notes);
      setValue('member', fixedExpense.member);
      setValue('is_active', fixedExpense.is_active);
      setValue('allow_value_edit', fixedExpense.allow_value_edit);
      if (fixedExpense.credit_card) {
        setPaymentType('credit_card');
        setValue('credit_card', fixedExpense.credit_card);
        setValue('account', undefined);
      } else if (fixedExpense.account) {
        setPaymentType('account');
        setValue('account', fixedExpense.account);
        setValue('credit_card', undefined);
      }
    } else if (accounts.length > 0) {
      setValue('account', accounts[0].id);
      setValue('credit_card', undefined);
    }
  }, [fixedExpense, accounts, setValue]);

  useEffect(() => {
    if (paymentType === 'account') {
      setValue('credit_card', undefined);
      if (accounts.length > 0 && !watch('account')) setValue('account', accounts[0].id);
    } else {
      setValue('account', undefined);
      if (creditCards.length > 0 && !watch('credit_card'))
        setValue('credit_card', creditCards[0].id);
    }
  }, [paymentType, accounts, creditCards, setValue, watch]);

  const watchedDefaultValue = watch('default_value') ?? 0;
  const watchedIsActive = watch('is_active');
  const watchedAllowValueEdit = watch('allow_value_edit');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      {/* Seção: Informações Básicas */}
      <FormSection title={t('common.form.sections.basicInfo')} icon={Store}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="description" className="flex items-center gap-xs">
              <Store className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.fixedExpenses.form.descriptionLabel')}
            </Label>
            <Input
              id="description"
              {...register('description', { required: true })}
              placeholder={t('pages.fixedExpenses.form.descriptionPlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label htmlFor="merchant" className="flex items-center gap-xs">
              <Store className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.fixedExpenses.form.merchantLabel')}
            </Label>
            <Input
              id="merchant"
              {...register('merchant')}
              placeholder={t('pages.fixedExpenses.form.merchantPlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.fixedExpenses.form.categoryLabel')}
            </Label>
            <Select
              value={watch('category') || ''}
              onValueChange={(v) => setValue('category', v)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('pages.fixedExpenses.form.categoryPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES_CANONICAL.map(({ key }) => {
                  const Icon = EXPENSE_CATEGORY_ICONS[key];
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {Icon && (
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        {translate('expenseCategories', key)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      {/* Seção: Valores & Vencimento */}
      <FormSection title={t('common.form.sections.values')} icon={Wallet}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label htmlFor="default_value" className="flex items-center gap-xs">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.fixedExpenses.form.defaultValueLabel')}
            </Label>
            <CurrencyInput
              id="default_value"
              accentColor="destructive"
              value={watchedDefaultValue}
              onChange={(e) =>
                setValue('default_value', parseFloat(e.target.value) || 0)
              }
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label htmlFor="due_day" className="flex items-center gap-xs">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.fixedExpenses.form.dueDayLabel')}
            </Label>
            <Input
              id="due_day"
              type="number"
              min="1"
              max="31"
              {...register('due_day', { required: true, valueAsNumber: true })}
              disabled={isLoading}
            />
          </div>
        </div>
      </FormSection>

      {/* Seção: Tipo de Pagamento */}
      <FormSection title={t('common.form.sections.paymentType')} icon={Wallet}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <div className="flex rounded-md border border-border/70 bg-muted/30 p-0.5">
              {(['account', 'credit_card'] as const).map((type) => {
                const Icon = type === 'account' ? Wallet : CreditCard;
                const label =
                  type === 'account'
                    ? t('pages.fixedExpenses.form.paymentTypeAccount')
                    : t('pages.fixedExpenses.form.paymentTypeCreditCard');
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPaymentType(type)}
                    disabled={isLoading}
                    className={`flex flex-1 items-center justify-center gap-xs rounded px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                      paymentType === type
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('pages.fixedExpenses.form.paymentTypeHint')}
            </p>
          </div>

          {paymentType === 'account' ? (
            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.fixedExpenses.form.accountLabel')}
              </Label>
              <Select
                value={watch('account')?.toString() || ''}
                onValueChange={(v) => setValue('account', parseInt(v))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('pages.fixedExpenses.form.accountPlaceholder')}
                  />
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
          ) : (
            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.fixedExpenses.form.creditCardLabel')}
              </Label>
              <Select
                value={watch('credit_card')?.toString() || ''}
                onValueChange={(v) => setValue('credit_card', parseInt(v))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('pages.fixedExpenses.form.creditCardPlaceholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {creditCards.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name} — {c.on_card_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('pages.fixedExpenses.form.creditCardHint')}
              </p>
            </div>
          )}

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.fixedExpenses.form.paymentMethodLabel')}
            </Label>
            <Select
              value={watch('payment_method') || ''}
              onValueChange={(v) => setValue('payment_method', v)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('pages.fixedExpenses.form.paymentMethodPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">⚡ PIX</SelectItem>
                <SelectItem value="debit_card">
                  💳 {t('common.paymentMethods.debit_card')}
                </SelectItem>
                <SelectItem value="transfer">
                  🏦 {t('common.paymentMethods.transfer')}
                </SelectItem>
                <SelectItem value="other">
                  📦 {t('common.paymentMethods.other')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      {/* Seção: Configuração */}
      <FormSection title={t('common.form.sections.paymentConfig')} icon={Tag}>
        <div className="space-y-md">
          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.fixedExpenses.form.notesLabel')}
            </Label>
            <Textarea
              {...register('notes')}
              placeholder={t('pages.fixedExpenses.form.notesPlaceholder')}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="space-y-sm">
            <div className="flex items-center gap-sm">
              <Checkbox
                id="is_active"
                checked={watchedIsActive}
                onCheckedChange={(checked) => setValue('is_active', !!checked)}
                disabled={isLoading}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                {t('pages.fixedExpenses.form.isActiveLabel')}
              </Label>
            </div>
            <p className="ml-6 text-xs text-muted-foreground">
              {t('pages.fixedExpenses.form.isActiveHint')}
            </p>
          </div>

          <div className="space-y-sm">
            <div className="flex items-center gap-sm">
              <Checkbox
                id="allow_value_edit"
                checked={watchedAllowValueEdit}
                onCheckedChange={(checked) => setValue('allow_value_edit', !!checked)}
                disabled={isLoading}
              />
              <Label htmlFor="allow_value_edit" className="cursor-pointer">
                {t('pages.fixedExpenses.form.allowValueEditLabel')}
              </Label>
            </div>
            <p className="ml-6 text-xs text-muted-foreground">
              {t('pages.fixedExpenses.form.allowValueEditHint')}
            </p>
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end gap-sm border-t pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? t('common.actions.saving')
            : fixedExpense
              ? t('common.actions.update')
              : t('common.actions.create')}
        </Button>
      </div>
    </form>
  );
};
