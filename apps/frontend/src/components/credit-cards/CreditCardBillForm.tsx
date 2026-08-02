/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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
import { TRANSLATIONS } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { logger } from '@/lib/logger';
import { formatLocalDate, parseLocalDate } from '@/lib/utils';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardExpensesService } from '@/services/credit-card-expenses-service';
import type { CreditCardBill, CreditCardBillFormData, CreditCard } from '@/types';

const MONTH_KEYS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const MAX_DUE_DATE_OFFSET_DAYS = 7;

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
  const { register, handleSubmit, setValue, reset, control } =
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

  const watchedCreditCard = useWatch({ control, name: 'credit_card' });
  const watchedYear = useWatch({ control, name: 'year' });
  const watchedMonth = useWatch({ control, name: 'month' });
  const watchedInvoiceBeginningDate = useWatch({
    control,
    name: 'invoice_beginning_date',
  });
  const watchedInvoiceEndingDate = useWatch({ control, name: 'invoice_ending_date' });
  const watchedDueDate = useWatch({ control, name: 'due_date' });
  const watchedPaymentDate = useWatch({ control, name: 'payment_date' });
  const [autoFilledFromPrevious, setAutoFilledFromPrevious] = useState(false);

  // Preenchimento rápido: quando cartão + ano + mês são selecionados numa fatura
  // nova e a fatura do mês imediatamente anterior já existe, deriva início/fim/
  // vencimento a partir dela (início = fim anterior + 1 dia; fim mantém o mesmo
  // dia de fechamento dentro do mês selecionado; vencimento repete o intervalo
  // usado antes, limitado a 7 dias corridos após o fim).
  useQuery({
    queryKey: [
      'credit-card-bill-form-autofill',
      bill?.id,
      watchedCreditCard,
      watchedYear,
      watchedMonth,
    ],
    enabled: !bill && !!watchedCreditCard && watchedCreditCard > 0 && !!watchedYear,
    queryFn: async () => {
      setAutoFilledFromPrevious(false);

      const monthIndex = MONTH_KEYS.indexOf(
        watchedMonth as (typeof MONTH_KEYS)[number]
      );
      if (monthIndex === -1) return null;

      const selectedYear = parseInt(watchedYear, 10);
      const previousMonth = MONTH_KEYS[(monthIndex + 11) % 12];
      const previousYear = monthIndex === 0 ? selectedYear - 1 : selectedYear;

      const previousBills = await creditCardBillsService.getAll({
        credit_card: watchedCreditCard,
        year: previousYear.toString(),
      });
      const previousBill = previousBills.find((b) => b.month === previousMonth);
      if (!previousBill) return null;

      const previousEnd = parseLocalDate(previousBill.invoice_ending_date);
      if (!previousEnd) return null;

      const newStart = new Date(previousEnd);
      newStart.setDate(newStart.getDate() + 1);

      const daysInSelectedMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
      const targetDay = Math.min(previousEnd.getDate(), daysInSelectedMonth);
      let newEnd = new Date(selectedYear, monthIndex, targetDay);
      if (newEnd <= newStart) {
        newEnd = new Date(selectedYear, monthIndex, daysInSelectedMonth);
      }

      let dueOffsetDays = MAX_DUE_DATE_OFFSET_DAYS;
      const previousDue = previousBill.due_date
        ? parseLocalDate(previousBill.due_date)
        : undefined;
      if (previousDue) {
        const previousOffset = Math.round(
          (previousDue.getTime() - previousEnd.getTime()) / 86_400_000
        );
        if (previousOffset > 0) {
          dueOffsetDays = Math.min(previousOffset, MAX_DUE_DATE_OFFSET_DAYS);
        }
      }
      const newDue = new Date(newEnd);
      newDue.setDate(newDue.getDate() + dueOffsetDays);

      setValue('invoice_beginning_date', formatLocalDate(newStart));
      setValue('invoice_ending_date', formatLocalDate(newEnd));
      setValue('due_date', formatLocalDate(newDue));
      setAutoFilledFromPrevious(true);

      return true;
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

  // Dispara reset/cálculo inicial via useQuery — evita setState direto dentro
  // de um useEffect puro, mantendo a lógica inalterada.
  useQuery({
    queryKey: ['credit-card-bill-form-init', bill?.id, creditCards.length],
    queryFn: async () => {
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
        await calculateBillAmounts(bill.id);
      } else if (creditCards.length > 0) {
        setValue('credit_card', creditCards[0].id);
      }
      return true;
    },
  });

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
      <FormSection title={t('pages.creditCardBills.form.sectionBasic')}>
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label>{t('pages.creditCardBills.form.creditCardLabel')}</Label>
            <Select
              value={watchedCreditCard > 0 ? watchedCreditCard.toString() : ''}
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
                    digitsOnly && digitsOnly.length >= 4
                      ? digitsOnly.slice(-4)
                      : '****';
                  const brandName =
                    TRANSLATIONS.cardBrands[
                      c.flag as keyof typeof TRANSLATIONS.cardBrands
                    ] || c.flag;
                  const accountName =
                    c.associated_account_name ||
                    t('components.creditCards.accountNotProvided');
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
            <Select value={watchedYear} onValueChange={(v) => setValue('year', v)}>
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
            <Select value={watchedMonth} onValueChange={(v) => setValue('month', v)}>
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

          {autoFilledFromPrevious && (
            <p className="text-success text-xs md:col-span-2">
              {t('pages.creditCardBills.form.autoFilledHint')}
            </p>
          )}

          <div className="space-y-sm">
            <Label htmlFor="invoice_beginning_date">
              {t('pages.creditCardBills.form.startDateLabel')}
            </Label>
            <DatePicker
              value={watchedInvoiceBeginningDate}
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
              value={watchedInvoiceEndingDate}
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
              value={watchedDueDate}
              onChange={(date) =>
                setValue('due_date', date ? formatLocalDate(date) : '')
              }
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
                <p className="text-muted-foreground text-xs">
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
                  className="text-warning font-semibold"
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
                  className="text-success font-semibold"
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
                  value={watchedPaymentDate}
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
      </FormSection>

      <div className="gap-sm pt-md flex justify-end">
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
