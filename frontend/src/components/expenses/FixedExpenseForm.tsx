import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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
import { logger } from '@/lib/logger';
import { membersService } from '@/services/members-service';
import type { FixedExpense, FixedExpenseFormData, Account, CreditCard } from '@/types';

interface Props {
  fixedExpense?: FixedExpense;
  accounts: Account[];
  creditCards: CreditCard[];
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
        if (!fixedExpense) {
          setValue('member', member.id);
        }
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

      // Detectar se é conta ou cartão
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

  // Atualizar valores ao mudar o tipo de pagamento
  useEffect(() => {
    if (paymentType === 'account') {
      setValue('credit_card', undefined);
      if (accounts.length > 0 && !watch('account')) {
        setValue('account', accounts[0].id);
      }
    } else {
      setValue('account', undefined);
      if (creditCards.length > 0 && !watch('credit_card')) {
        setValue('credit_card', creditCards[0].id);
      }
    }
  }, [paymentType, accounts, creditCards, setValue, watch]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">
            {t('pages.fixedExpenses.form.descriptionLabel')}
          </Label>
          <Input
            id="description"
            {...register('description', { required: true })}
            placeholder={t('pages.fixedExpenses.form.descriptionPlaceholder')}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="default_value">
            {t('pages.fixedExpenses.form.defaultValueLabel')}
          </Label>
          <Input
            id="default_value"
            type="number"
            step="0.01"
            {...register('default_value', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_day">{t('pages.fixedExpenses.form.dueDayLabel')}</Label>
          <Input
            id="due_day"
            type="number"
            min="1"
            max="31"
            {...register('due_day', { required: true, valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('pages.fixedExpenses.form.categoryLabel')}</Label>
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
              {EXPENSE_CATEGORIES_CANONICAL.map(({ key }) => (
                <SelectItem key={key} value={key}>
                  {translate('expenseCategories', key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>{t('pages.fixedExpenses.form.paymentTypeLabel')}</Label>
          <Select
            value={paymentType}
            onValueChange={(v: 'account' | 'credit_card') => setPaymentType(v)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="account">
                {t('pages.fixedExpenses.form.paymentTypeAccount')}
              </SelectItem>
              <SelectItem value="credit_card">
                {t('pages.fixedExpenses.form.paymentTypeCreditCard')}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs">{t('pages.fixedExpenses.form.paymentTypeHint')}</p>
        </div>

        {paymentType === 'account' ? (
          <div className="space-y-2">
            <Label>{t('pages.fixedExpenses.form.accountLabel')}</Label>
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
          <div className="space-y-2">
            <Label>{t('pages.fixedExpenses.form.creditCardLabel')}</Label>
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
                    {c.name} - {c.on_card_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs">{t('pages.fixedExpenses.form.creditCardHint')}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="merchant">
            {t('pages.fixedExpenses.form.merchantLabel')}
          </Label>
          <Input
            id="merchant"
            {...register('merchant')}
            placeholder={t('pages.fixedExpenses.form.merchantPlaceholder')}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('pages.fixedExpenses.form.paymentMethodLabel')}</Label>
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
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="debit_card">
                {t('common.paymentMethods.debit_card')}
              </SelectItem>
              <SelectItem value="transfer">
                {t('common.paymentMethods.transfer')}
              </SelectItem>
              <SelectItem value="other">{t('common.paymentMethods.other')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">{t('pages.fixedExpenses.form.notesLabel')}</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder={t('pages.fixedExpenses.form.notesPlaceholder')}
            disabled={isLoading}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register('is_active')}
              className="rounded"
              disabled={isLoading}
            />
            {t('pages.fixedExpenses.form.isActiveLabel')}
          </Label>
          <p className="text-xs">{t('pages.fixedExpenses.form.isActiveHint')}</p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register('allow_value_edit')}
              className="rounded"
              disabled={isLoading}
            />
            {t('pages.fixedExpenses.form.allowValueEditLabel')}
          </Label>
          <p className="text-xs">{t('pages.fixedExpenses.form.allowValueEditHint')}</p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
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
