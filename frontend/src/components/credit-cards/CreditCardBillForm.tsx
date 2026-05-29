/* eslint-disable max-lines */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TRANSLATIONS } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { logger } from '@/lib/logger';
import { formatLocalDate } from '@/lib/utils';
import { creditCardExpensesService } from '@/services/credit-card-expenses-service';
import type { CreditCardBill, CreditCardBillFormData, CreditCard } from '@/types';
interface CreditCardBillFormProps {
  bill?: CreditCardBill;
  creditCards: CreditCard[];
  onSubmit: (data: CreditCardBillFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const CreditCardBillForm: React.FC<CreditCardBillFormProps> = ({
  bill,
  creditCards,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { showAlert } = useAlertDialog();
  const { t } = useTranslation();
  const [isCalculating, setIsCalculating] = useState(false);
  const { register, handleSubmit, setValue, watch, reset } =
    useForm<CreditCardBillFormData>({
      defaultValues: bill
        ? {
            credit_card: bill.credit_card,
            year: bill.year,
            month: bill.month,
            invoice_beginning_date: bill.invoice_beginning_date,
            invoice_ending_date: bill.invoice_ending_date,
            closed: bill.closed,
            total_amount: parseFloat(bill.total_amount),
            minimum_payment: parseFloat(bill.minimum_payment),
            paid_amount: parseFloat(bill.paid_amount),
            interest_charged: parseFloat(bill.interest_charged),
            late_fee: parseFloat(bill.late_fee),
            status: bill.status,
            due_date: bill.due_date || '',
            payment_date: bill.payment_date || '',
          }
        : {
            credit_card: 0,
            year: new Date().getFullYear().toString(),
            month: 'Jan',
            invoice_beginning_date: formatLocalDate(new Date()),
            invoice_ending_date: formatLocalDate(new Date()),
            closed: false,
          },
    });

  // Função para calcular valores automaticamente
  const calculateBillAmounts = async (billId?: number) => {
    if (!billId) return;

    try {
      setIsCalculating(true);
      // Buscar todas as despesas associadas à esta fatura
      const expenses = await creditCardExpensesService.getByBill(billId);

      // Calcular total das despesas
      const totalAmount = expenses.reduce((sum, exp) => sum + parseFloat(exp.value), 0);

      // Calcular valor já pago (despesas marcadas como pagas)
      const paidAmount = expenses
        .filter((exp) => exp.payed)
        .reduce((sum, exp) => sum + parseFloat(exp.value), 0);

      // Calcular pagamento mínimo (10% do total)
      const minimumPayment = totalAmount * 0.1;

      setValue('total_amount', totalAmount);
      setValue('minimum_payment', minimumPayment);
      setValue('paid_amount', paidAmount);
    } catch (error) {
      logger.error('Erro ao calcular valores da fatura:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    if (bill && creditCards.length > 0) {
      reset({
        credit_card: bill.credit_card,
        year: bill.year,
        month: bill.month,
        invoice_beginning_date: bill.invoice_beginning_date,
        invoice_ending_date: bill.invoice_ending_date,
        closed: bill.closed,
        total_amount: parseFloat(bill.total_amount),
        minimum_payment: parseFloat(bill.minimum_payment),
        paid_amount: parseFloat(bill.paid_amount),
        interest_charged: parseFloat(bill.interest_charged),
        late_fee: parseFloat(bill.late_fee),
        status: bill.status,
        due_date: bill.due_date || '',
        payment_date: bill.payment_date || '',
      });
      // Calcular valores automaticamente ao carregar fatura existente
      void calculateBillAmounts(bill.id);
    } else if (creditCards.length > 0) {
      setValue('credit_card', creditCards[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill, creditCards, setValue, reset]);

  const handleFormSubmit = async (data: CreditCardBillFormData) => {
    if (!data.credit_card || data.credit_card === 0) {
      await showAlert({
        title: t('pages.creditCardBills.form.requiredCardAlert'),
        description: t('pages.creditCardBills.form.requiredCardAlertDesc'),
        confirmText: 'Ok',
      });
      return;
    }

    // Validações de datas
    const beginningDate = new Date(data.invoice_beginning_date);
    const endingDate = new Date(data.invoice_ending_date);
    const dueDate =
      data.due_date && data.due_date.trim() !== '' ? new Date(data.due_date) : null;

    // Validação: Data de início deve ser anterior à data de fechamento
    if (beginningDate >= endingDate) {
      await showAlert({
        title: t('pages.creditCardBills.form.invalidDateAlert'),
        description: t('pages.creditCardBills.form.startBeforeEndDesc'),
        confirmText: 'Ok',
      });
      return;
    }

    // Validações quando a data de vencimento é fornecida
    if (dueDate) {
      // Validação: Data de início deve ser anterior à data de vencimento
      if (beginningDate >= dueDate) {
        await showAlert({
          title: t('pages.creditCardBills.form.invalidDateAlert'),
          description: t('pages.creditCardBills.form.startBeforeDueDateDesc'),
          confirmText: 'Ok',
        });
        return;
      }

      // Validação: Data de fechamento deve ser anterior à data de vencimento
      if (endingDate >= dueDate) {
        await showAlert({
          title: t('pages.creditCardBills.form.invalidDateAlert'),
          description: t('pages.creditCardBills.form.endBeforeDueDateDesc'),
          confirmText: 'Ok',
        });
        return;
      }
    }

    // Garantir que campos de data vazios sejam enviados como undefined ao invés de strings vazias
    const sanitizedData = {
      ...data,
      due_date:
        data.due_date && data.due_date.trim() !== '' ? data.due_date : undefined,
      payment_date:
        data.payment_date && data.payment_date.trim() !== ''
          ? data.payment_date
          : undefined,
      closed: data.closed !== undefined ? data.closed : false,
    };

    onSubmit(sanitizedData);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 1 + i).toString());

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-md">
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <div className="space-y-sm md:col-span-2">
          <Label>{t('pages.creditCardBills.form.creditCardLabel')}</Label>
          <Select
            value={watch('credit_card') > 0 ? watch('credit_card').toString() : ''}
            onValueChange={(v) => setValue('credit_card', parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={t('pages.creditCardBills.form.creditCardPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              {creditCards.map((c) => {
                // Extrai apenas os dígitos do número mascarado
                const digitsOnly = c.card_number_masked
                  ? c.card_number_masked.replace(/[^\d]/g, '')
                  : '';
                const last4 =
                  digitsOnly && digitsOnly.length >= 4 ? digitsOnly.slice(-4) : '****';
                const brandName =
                  TRANSLATIONS.cardBrands[
                    c.flag as keyof typeof TRANSLATIONS.cardBrands
                  ] || c.flag;
                const accountName = c.associated_account_name || 'Conta não informada';
                return (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.on_card_name} ****{last4} - {brandName} - {accountName}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-sm">
          <Label>{t('pages.creditCardBills.form.yearLabel')}</Label>
          <Select value={watch('year')} onValueChange={(v) => setValue('year', v)}>
            <SelectTrigger>
              <SelectValue
                placeholder={t('pages.creditCardBills.form.yearPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-sm">
          <Label>{t('pages.creditCardBills.form.monthLabel')}</Label>
          <Select value={watch('month')} onValueChange={(v) => setValue('month', v)}>
            <SelectTrigger>
              <SelectValue
                placeholder={t('pages.creditCardBills.form.monthPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TRANSLATIONS.months).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-sm">
          <Label htmlFor="invoice_beginning_date">
            {t('pages.creditCardBills.form.startDateLabel')}
          </Label>
          <DatePicker
            value={watch('invoice_beginning_date')}
            onChange={(date) =>
              setValue('invoice_beginning_date', date ? formatLocalDate(date) : '')
            }
            placeholder={t('pages.creditCardBills.form.startDatePlaceholder')}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-sm">
          <Label htmlFor="invoice_ending_date">
            {t('pages.creditCardBills.form.endDateLabel')}
          </Label>
          <DatePicker
            value={watch('invoice_ending_date')}
            onChange={(date) =>
              setValue('invoice_ending_date', date ? formatLocalDate(date) : '')
            }
            placeholder={t('pages.creditCardBills.form.endDatePlaceholder')}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-sm">
          <Label htmlFor="due_date">
            {t('pages.creditCardBills.form.dueDateLabel')}
          </Label>
          <DatePicker
            value={watch('due_date')}
            onChange={(date) => setValue('due_date', date ? formatLocalDate(date) : '')}
            placeholder={t('pages.creditCardBills.form.dueDatePlaceholder')}
            disabled={isLoading}
          />
        </div>

        {bill && (
          <>
            <div className="space-y-sm">
              <div className="flex items-center justify-between">
                <Label htmlFor="total_amount">
                  {t('pages.creditCardBills.form.totalAmountLabel')}
                </Label>
                {isCalculating && (
                  <span className="text-xs">
                    {t('pages.creditCardBills.form.calculating')}
                  </span>
                )}
              </div>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                {...register('total_amount', { valueAsNumber: true })}
                placeholder="0.00"
                className="font-semibold"
              />
              <p className="text-xs text-muted-foreground">
                {t('pages.creditCardBills.form.totalAmountHint')}
              </p>
            </div>

            <div className="space-y-sm">
              <Label htmlFor="minimum_payment">
                {t('pages.creditCardBills.form.minPaymentLabel')}
              </Label>
              <Input
                id="minimum_payment"
                type="number"
                step="0.01"
                {...register('minimum_payment', { valueAsNumber: true })}
                placeholder="0.00"
                disabled
                className="font-semibold text-warning"
              />
              <p className="text-xs">
                {t('pages.creditCardBills.form.minPaymentHint')}
              </p>
            </div>

            <div className="space-y-sm">
              <Label htmlFor="paid_amount">
                {t('pages.creditCardBills.form.paidAmountLabel')}
              </Label>
              <Input
                id="paid_amount"
                type="number"
                step="0.01"
                {...register('paid_amount', { valueAsNumber: true })}
                placeholder="0.00"
                disabled
                className="font-semibold text-success"
              />
              <p className="text-xs">
                {t('pages.creditCardBills.form.paidAmountHint')}
              </p>
            </div>

            <div className="space-y-sm">
              <Label htmlFor="payment_date">
                {t('pages.creditCardBills.form.paymentDateLabel')}
              </Label>
              <DatePicker
                value={watch('payment_date')}
                onChange={(date) =>
                  setValue('payment_date', date ? formatLocalDate(date) : '')
                }
                placeholder={t('pages.creditCardBills.form.paymentDatePlaceholder')}
                disabled={isLoading}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-sm pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? t('common.actions.saving')
            : bill
              ? t('common.actions.update')
              : t('common.actions.create')}
        </Button>
      </div>
    </form>
  );
};
