/* eslint-disable react-hooks/incompatible-library */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
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
import { translate, TRANSLATIONS } from '@/config/constants';
import { formatDate, formatCurrency } from '@/lib/formatters';
import type {
  CreditCardInstallment,
  CreditCardInstallmentUpdateData,
  CreditCardBill,
} from '@/types';

interface CreditCardInstallmentFormProps {
  installment: CreditCardInstallment;
  bills: CreditCardBill[];
  onSubmit: (data: CreditCardInstallmentUpdateData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const CreditCardInstallmentForm: React.FC<CreditCardInstallmentFormProps> = ({
  installment,
  bills,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const { register, handleSubmit, setValue, watch } =
    useForm<CreditCardInstallmentUpdateData>({
      defaultValues: {
        value: installment.value,
        payed: installment.payed,
        bill: installment.bill,
      },
    });

  useEffect(() => {
    setValue('value', installment.value);
    setValue('payed', installment.payed);
    setValue('bill', installment.bill);
  }, [installment, setValue]);

  // Filtrar faturas do mesmo cartão
  const availableBills = bills.filter((b) => b.credit_card === installment.card_id);

  const handleFormSubmit = (data: CreditCardInstallmentUpdateData) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-md">
      {/* Informações da parcela (somente leitura) */}
      <div className="space-y-sm rounded-lg bg-muted/50 p-md">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {t('pages.creditCardExpenses.installmentForm.purchaseLabel')}
          </span>
          <span className="font-semibold">{installment.description}</span>
        </div>
        {installment.merchant && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {t('pages.creditCardExpenses.installmentForm.merchantLabel')}
            </span>
            <span className="text-sm">{installment.merchant}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {t('pages.creditCardExpenses.installmentForm.categoryLabel')}
          </span>
          <Badge variant="secondary">
            {translate('expenseCategories', installment.category || '')}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {t('pages.creditCardExpenses.installmentForm.installmentLabel')}
          </span>
          <span className="font-semibold">
            {installment.installment_number}/{installment.total_installments}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {t('pages.creditCardExpenses.installmentForm.dueDateLabel')}
          </span>
          <span className="text-sm">
            {formatDate(installment.due_date, 'dd/MM/yyyy')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {t('pages.creditCardExpenses.installmentForm.purchaseDateLabel')}
          </span>
          <span className="text-sm">
            {formatDate(installment.purchase_date || '', 'dd/MM/yyyy')}
          </span>
        </div>
      </div>

      {/* Campos editáveis */}
      <div className="space-y-md">
        <div className="space-y-sm">
          <Label htmlFor="value">
            {t('pages.creditCardExpenses.installmentForm.installmentValueLabel')}
          </Label>
          <Input
            id="value"
            type="number"
            step="0.01"
            {...register('value', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            {t('pages.creditCardExpenses.installmentForm.originalValueHint', {
              value: formatCurrency(installment.value),
            })}
          </p>
        </div>

        <div className="space-y-sm">
          <Label>
            {t('pages.creditCardExpenses.installmentForm.paymentStatusLabel')}
          </Label>
          <Select
            value={watch('payed') ? 'true' : 'false'}
            onValueChange={(v) => setValue('payed', v === 'true')}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={t(
                  'pages.creditCardExpenses.installmentForm.billPlaceholder'
                )}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">{t('common.status.pending')}</SelectItem>
              <SelectItem value="true">{t('common.status.paid')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-sm">
          <Label>{t('pages.creditCardExpenses.installmentForm.billLabel')}</Label>
          <Select
            value={watch('bill')?.toString() || 'none'}
            onValueChange={(v) => setValue('bill', v === 'none' ? null : parseInt(v))}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={t(
                  'pages.creditCardExpenses.installmentForm.billPlaceholder'
                )}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {t('pages.creditCardExpenses.installmentForm.billNone')}
              </SelectItem>
              {availableBills.map((b) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  {TRANSLATIONS.months[b.month as keyof typeof TRANSLATIONS.months]}/
                  {b.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-sm pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? t('common.actions.saving') : t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
};
