/* eslint-disable max-lines */
import {
  CalendarDays,
  Clock,
  CreditCard,
  FileText,
  Layers,
  Minus,
  Plus,
  Receipt,
  Tag,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
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
import { TimePicker } from '@/components/ui/time-picker';
import {
  EXPENSE_CATEGORIES_CANONICAL,
  TRANSLATIONS,
  translate,
} from '@/config/constants';
import { EXPENSE_CATEGORY_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { formatLocalDate } from '@/lib/utils';
import type {
  CreditCard as CreditCardType,
  CreditCardBill,
  CreditCardExpense,
  CreditCardExpenseFormData,
} from '@/types';

interface CreditCardExpenseFormProps {
  expense?: CreditCardExpense;
  creditCards: CreditCardType[];
  bills?: CreditCardBill[];
  onSubmit: (data: CreditCardExpenseFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const CreditCardExpenseForm: React.FC<CreditCardExpenseFormProps> = ({
  expense,
  creditCards,
  bills = [],
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertDialog();
  const { register, handleSubmit, setValue, watch } =
    useForm<CreditCardExpenseFormData>({
      defaultValues: {
        description: '',
        value: 0,
        date: formatLocalDate(new Date()),
        horary: new Date().toTimeString().split(' ')[0].substring(0, 5),
        category: '',
        card: 0,
        total_installments: 1,
        bill: null,
        member: null,
        notes: '',
      },
    });

  const watchedValue = watch('value');
  const watchedTotalInstallments = watch('total_installments');
  const watchedCard = watch('card');
  const watchedCategory = watch('category');

  const installmentValue =
    watchedTotalInstallments > 0
      ? watchedValue / watchedTotalInstallments
      : watchedValue;

  const filteredBills = useMemo(() => {
    if (!watchedCard || watchedCard === 0) return [];
    return bills.filter((b) => b.credit_card === watchedCard);
  }, [watchedCard, bills]);

  const getCurrentBill = (cardId: number) => {
    if (!bills || bills.length === 0) return null;
    const today = new Date();
    const cardBills = bills.filter((b) => b.credit_card === cardId);
    const currentBill = cardBills.find((b) => {
      const beginDate = new Date(b.invoice_beginning_date);
      const endDate = new Date(b.invoice_ending_date);
      return today >= beginDate && today <= endDate;
    });
    if (currentBill) return currentBill.id;
    const openBills = cardBills.filter((b) => b.status === 'open');
    if (openBills.length > 0) {
      openBills.sort(
        (a, b) =>
          new Date(b.invoice_beginning_date).getTime() -
          new Date(a.invoice_beginning_date).getTime()
      );
      return openBills[0].id;
    }
    if (cardBills.length > 0) return cardBills[0].id;
    return null;
  };

  const getCardDisplayInfo = (card: CreditCardType) => {
    const digitsOnly = card.card_number_masked?.replace(/[^\d]/g, '') || '';
    const last4 = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : null;
    const hasNumber = last4 !== null;
    const brandName =
      TRANSLATIONS.cardBrands[card.flag as keyof typeof TRANSLATIONS.cardBrands] ||
      card.flag;
    const accountName = card.associated_account_name || '';
    return { last4, hasNumber, brandName, accountName };
  };

  useEffect(() => {
    if (!expense && creditCards.length > 0) {
      const firstCard = creditCards[0];
      setValue('card', firstCard.id);
      if (firstCard.owner) setValue('member', firstCard.owner);
      const billId = getCurrentBill(firstCard.id);
      if (billId) setValue('bill', billId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense, creditCards.length]);

  useEffect(() => {
    if (watchedCard && watchedCard !== 0 && creditCards.length > 0 && !expense) {
      const selectedCard = creditCards.find((c) => c.id === watchedCard);
      if (selectedCard?.owner) setValue('member', selectedCard.owner);
      const billId = getCurrentBill(watchedCard);
      setValue('bill', billId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedCard]);

  useEffect(() => {
    if (expense) {
      setValue('description', expense.description);
      setValue('value', parseFloat(expense.value));
      setValue('date', expense.date);
      setValue('horary', expense.horary);
      setValue('category', expense.category);
      setValue('card', expense.card);
      setValue('total_installments', expense.total_installments);
      setValue('bill', expense.bill);
      setValue('member', expense.member);
      setValue('notes', expense.notes || '');
    }
  }, [expense, setValue]);

  const handleFormSubmit = async (data: CreditCardExpenseFormData) => {
    if (!data.card || data.card === 0) {
      await showAlert({
        title: t('pages.creditCardExpenses.form.requiredField'),
        description: t('pages.creditCardExpenses.form.requiredCard'),
        confirmText: 'Ok',
      });
      return;
    }
    if (!data.category) {
      await showAlert({
        title: t('pages.creditCardExpenses.form.requiredField'),
        description: t('pages.creditCardExpenses.form.requiredCategory'),
        confirmText: 'Ok',
      });
      return;
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
      {/* Seção: Identificação */}
      <FormSection title={t('common.form.sections.basicInfo')} icon={Receipt}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="description" className="flex items-center gap-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.creditCardExpenses.form.descriptionLabel')}
            </Label>
            <Input
              id="description"
              {...register('description', { required: true })}
              placeholder={t('pages.creditCardExpenses.form.descriptionPlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label className="flex items-center gap-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.creditCardExpenses.form.categoryLabel')}
            </Label>
            <Select
              value={watchedCategory || ''}
              onValueChange={(v) => setValue('category', v)}
            >
              <SelectTrigger>
                {watchedCategory ? (
                  <span className="flex items-center gap-2">
                    {(() => {
                      const TrigIcon = EXPENSE_CATEGORY_ICONS[watchedCategory];
                      return TrigIcon ? (
                        <TrigIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : null;
                    })()}
                    <span>{translate('expenseCategories', watchedCategory)}</span>
                  </span>
                ) : (
                  <SelectValue placeholder={t('common.fields.selectCategory')} />
                )}
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

      {/* Seção: Valores e Parcelas */}
      <FormSection title={t('common.form.sections.values')} icon={CreditCard}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="value" className="flex items-center gap-xs">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.creditCardExpenses.form.totalValueLabel')}
            </Label>
            <CurrencyInput
              id="value"
              accentColor="destructive"
              value={watchedValue}
              onChange={(e) => setValue('value', parseFloat(e.target.value) || 0)}
              disabled={isLoading || !!expense}
            />
            {expense && (
              <p className="text-xs text-warning">
                {t('pages.creditCardExpenses.form.totalValueWarning')}
              </p>
            )}
          </div>

          {/* Widget de parcelas */}
          <div className="space-y-sm md:col-span-2">
            <Label className="flex items-center gap-xs">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.creditCardExpenses.form.installmentsLabel')}
            </Label>
            {expense ? (
              <p className="text-sm text-warning">
                {t('pages.creditCardExpenses.form.installmentsWarning')}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-sm">
                  <button
                    type="button"
                    disabled={isLoading || watchedTotalInstallments <= 1}
                    onClick={() =>
                      setValue(
                        'total_installments',
                        Math.max(1, watchedTotalInstallments - 1)
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/30 transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-2xl font-bold">
                      {watchedTotalInstallments}
                    </span>
                    <span className="ml-xs text-sm text-muted-foreground">
                      {watchedTotalInstallments === 1 ? 'vez' : 'vezes'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      setValue('total_installments', watchedTotalInstallments + 1)
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/30 transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="rounded-md bg-muted/40 px-sm py-xs text-center text-sm">
                  {watchedTotalInstallments > 1
                    ? t('pages.creditCardExpenses.form.installmentsSummary', {
                        total: watchedValue.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }),
                        count: watchedTotalInstallments,
                        installmentValue: installmentValue.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }),
                      })
                    : t('pages.creditCardExpenses.form.paymentSight')}
                </div>
              </>
            )}
          </div>
        </div>
      </FormSection>

      {/* Seção: Data e Cartão */}
      <FormSection title={t('common.form.sections.schedule')} icon={CalendarDays}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label htmlFor="date" className="flex items-center gap-xs">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.creditCardExpenses.form.purchaseDateLabel')}
            </Label>
            <DatePicker
              value={watch('date')}
              onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
              placeholder={t('pages.creditCardExpenses.form.purchaseDatePlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label htmlFor="horary" className="flex items-center gap-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.creditCardExpenses.form.purchaseTimeLabel')}
            </Label>
            <TimePicker
              value={watch('horary')}
              onChange={(t) => setValue('horary', t ?? '')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.creditCardExpenses.form.cardLabel')}
            </Label>
            <Select
              value={watch('card')?.toString() || ''}
              onValueChange={(v) => setValue('card', parseInt(v))}
              disabled={isLoading || !!expense}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('common.fields.select')} />
              </SelectTrigger>
              <SelectContent>
                {creditCards.map((c) => {
                  const { last4, hasNumber, brandName, accountName } =
                    getCardDisplayInfo(c);
                  return (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      <div className="flex items-center gap-sm">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-sm">
                          {hasNumber
                            ? `**** ${last4}`
                            : t('pages.creditCardExpenses.form.cardNotRegistered')}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {brandName}
                        </Badge>
                        {accountName && (
                          <span className="text-xs">• {accountName}</span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {expense && (
              <p className="text-xs text-warning">
                {t('pages.creditCardExpenses.form.cardWarning')}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.creditCardExpenses.form.billAssociatedLabel')}
            </Label>
            <Select
              value={watch('bill')?.toString() || 'none'}
              onValueChange={(v) => setValue('bill', v === 'none' ? null : parseInt(v))}
              disabled={filteredBills.length === 0 || isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    filteredBills.length === 0
                      ? t('pages.creditCardExpenses.noBills')
                      : t('common.fields.select')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {t('pages.creditCardExpenses.form.none')}
                </SelectItem>
                {filteredBills.map((b) => (
                  <SelectItem key={b.id} value={b.id.toString()}>
                    {TRANSLATIONS.months[b.month as keyof typeof TRANSLATIONS.months]}/
                    {b.year}
                    {b.status === 'open' && (
                      <span className="ml-sm text-xs text-success">
                        ({t('pages.creditCardExpenses.status.open')})
                      </span>
                    )}
                    {b.status === 'closed' && (
                      <span className="ml-sm text-xs text-muted-foreground">
                        ({t('pages.creditCardExpenses.status.closed')})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filteredBills.length === 0 && watchedCard > 0 && (
              <p className="text-xs text-warning">
                {t('pages.creditCardExpenses.noBills')}
              </p>
            )}
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="notes" className="flex items-center gap-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.creditCardExpenses.form.notesLabel')}
            </Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder={t('pages.creditCardExpenses.form.notesPlaceholder')}
              disabled={isLoading}
              rows={3}
            />
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
            : expense
              ? t('common.actions.update')
              : t('common.actions.create')}
        </Button>
      </div>
    </form>
  );
};
