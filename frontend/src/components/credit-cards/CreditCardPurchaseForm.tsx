/* eslint-disable max-lines */
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import {
  TRANSLATIONS,
  EXPENSE_CATEGORIES_CANONICAL,
  translate,
} from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import type {
  CreditCardPurchase,
  CreditCardPurchaseFormData,
  CreditCard,
} from '@/types';

interface CreditCardPurchaseFormProps {
  purchase?: CreditCardPurchase;
  creditCards: CreditCard[];
  onSubmit: (data: CreditCardPurchaseFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const CreditCardPurchaseForm: React.FC<CreditCardPurchaseFormProps> = ({
  purchase,
  creditCards,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertDialog();
  const { register, handleSubmit, setValue, watch } =
    useForm<CreditCardPurchaseFormData>({
      defaultValues: {
        description: '',
        total_value: 0,
        purchase_date: formatLocalDate(new Date()),
        purchase_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        category: '',
        card: 0,
        total_installments: 1,
        merchant: '',
        member: null,
        notes: '',
      },
    });

  // Watch valores para cálculo de parcela
  const watchedTotalValue = watch('total_value');
  const watchedTotalInstallments = watch('total_installments');
  const watchedCard = watch('card');

  // Calcular valor por parcela
  const installmentValue = useMemo(() => {
    if (watchedTotalInstallments > 0 && watchedTotalValue > 0) {
      return watchedTotalValue / watchedTotalInstallments;
    }
    return watchedTotalValue || 0;
  }, [watchedTotalValue, watchedTotalInstallments]);

  // Obter informações do cartão selecionado (limite disponível)
  const selectedCardInfo = useMemo(() => {
    if (!watchedCard || watchedCard === 0) return null;
    const card = creditCards.find((c) => c.id === watchedCard);
    if (!card) return null;
    return {
      name: card.name,
      creditLimit: parseFloat(card.credit_limit),
      availableCredit: card.available_credit ?? parseFloat(card.credit_limit),
      usedCredit: card.used_credit ?? 0,
    };
  }, [watchedCard, creditCards]);

  // Verificar se valor excede limite disponível
  const exceedsLimit = useMemo(() => {
    if (!selectedCardInfo || !watchedTotalValue) return false;
    return watchedTotalValue > selectedCardInfo.availableCredit;
  }, [selectedCardInfo, watchedTotalValue]);

  // Função auxiliar para exibir informações do cartão
  const getCardDisplayInfo = (card: CreditCard) => {
    const digitsOnly = card.card_number_masked?.replace(/[^\d]/g, '') || '';
    const last4 = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : null;
    const hasNumber = last4 !== null;
    const brandName =
      TRANSLATIONS.cardBrands[card.flag as keyof typeof TRANSLATIONS.cardBrands] ||
      card.flag;
    const accountName = card.associated_account_name || '';

    return { last4, hasNumber, brandName, accountName };
  };

  // Auto-selecionar primeiro cartão ao abrir o form (modo criação)
  useEffect(() => {
    if (!purchase && creditCards.length > 0) {
      const firstCard = creditCards[0];
      setValue('card', firstCard.id);

      // Atualizar membro
      if (firstCard.owner) {
        setValue('member', firstCard.owner);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase, creditCards.length]);

  // Atualizar membro quando cartão muda
  useEffect(() => {
    if (watchedCard && watchedCard !== 0 && creditCards.length > 0 && !purchase) {
      const selectedCard = creditCards.find((c) => c.id === watchedCard);

      // Atualizar membro
      if (selectedCard?.owner) {
        setValue('member', selectedCard.owner);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedCard]);

  // Carregar dados da compra em edição
  useEffect(() => {
    if (purchase) {
      setValue('description', purchase.description);
      setValue('total_value', purchase.total_value);
      setValue('purchase_date', purchase.purchase_date);
      setValue('purchase_time', purchase.purchase_time);
      setValue('category', purchase.category);
      setValue('card', purchase.card);
      setValue('total_installments', purchase.total_installments);
      setValue('merchant', purchase.merchant || '');
      setValue('member', purchase.member);
      setValue('notes', purchase.notes || '');
    }
  }, [purchase, setValue]);

  const handleFormSubmit = async (data: CreditCardPurchaseFormData) => {
    if (!data.card || data.card === 0) {
      await showAlert({
        title: t('pages.creditCardExpenses.form.requiredField'),
        description: t('pages.creditCardExpenses.form.selectCardRequired'),
        confirmText: 'Ok',
      });
      return;
    }
    if (!data.category) {
      await showAlert({
        title: t('pages.creditCardExpenses.form.requiredField'),
        description: t('pages.creditCardExpenses.form.selectCategoryRequired'),
        confirmText: 'Ok',
      });
      return;
    }
    // Validar limite disponível (apenas para novas compras)
    if (
      !purchase &&
      selectedCardInfo &&
      data.total_value > selectedCardInfo.availableCredit
    ) {
      await showAlert({
        title: t('pages.creditCardExpenses.form.limitExceededTitle'),
        description: t('pages.creditCardExpenses.form.limitExceededDesc', {
          value: formatCurrency(data.total_value),
          limit: formatCurrency(selectedCardInfo.availableCredit),
        }),
        confirmText: 'Ok',
      });
      return;
    }
    onSubmit(data);
  };

  // Mostrar aviso quando edição não permite mudar parcelas
  const isEditMode = !!purchase;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-md">
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <div className="space-y-sm md:col-span-2">
          <Label htmlFor="description">
            {t('pages.creditCardExpenses.form.descriptionLabel')}
          </Label>
          <Input
            id="description"
            {...register('description', { required: true })}
            placeholder={t('pages.creditCardExpenses.form.descriptionPlaceholder')}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-sm">
          <Label htmlFor="total_value">
            {t('pages.creditCardExpenses.form.totalValueLabel')}
          </Label>
          <Input
            id="total_value"
            type="number"
            step="0.01"
            {...register('total_value', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading || isEditMode}
          />
          {isEditMode && (
            <p className="text-xs text-warning">
              {t('pages.creditCardExpenses.form.totalValueLocked')}
            </p>
          )}
        </div>

        <div className="space-y-sm">
          <Label>{t('pages.creditCardExpenses.form.categoryLabel')}</Label>
          <Select
            value={watch('category') || ''}
            onValueChange={(v) => setValue('category', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('common.actions.select')} />
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

        <div className="space-y-sm">
          <Label htmlFor="purchase_date">
            {t('pages.creditCardExpenses.form.purchaseDateLabel')}
          </Label>
          <DatePicker
            value={watch('purchase_date')}
            onChange={(date) =>
              setValue('purchase_date', date ? formatLocalDate(date) : '')
            }
            placeholder={t('common.fields.selectDate')}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-sm">
          <Label htmlFor="purchase_time">
            {t('pages.creditCardExpenses.form.purchaseTimeLabel')}
          </Label>
          <TimePicker
            value={watch('purchase_time')}
            onChange={(t) => setValue('purchase_time', t ?? '')}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-sm">
          <Label>{t('pages.creditCardExpenses.form.cardLabel')}</Label>
          <Select
            value={watch('card')?.toString() || ''}
            onValueChange={(v) => setValue('card', parseInt(v))}
            disabled={isEditMode}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('common.actions.select')} />
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
                          : t('pages.creditCardExpenses.form.noCardNumber')}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {brandName}
                      </Badge>
                      {accountName && <span className="text-xs">• {accountName}</span>}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {isEditMode && (
            <p className="text-xs text-warning">
              {t('pages.creditCardExpenses.form.cardLocked')}
            </p>
          )}
          {/* Exibir limite disponível do cartão selecionado */}
          {selectedCardInfo && !isEditMode && (
            <div
              className={`rounded-md p-sm text-sm ${exceedsLimit ? 'border border-destructive/30 bg-destructive/10' : 'bg-muted'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t('pages.creditCardExpenses.form.availableLimit')}:
                </span>
                <span
                  className={`font-semibold ${exceedsLimit ? 'text-destructive' : 'text-success'}`}
                >
                  {formatCurrency(selectedCardInfo.availableCredit)}
                </span>
              </div>
              {exceedsLimit && watchedTotalValue > 0 && (
                <p className="mt-xs text-xs text-destructive">
                  {t('pages.creditCardExpenses.form.exceedsLimitBy', {
                    amount: formatCurrency(
                      watchedTotalValue - selectedCardInfo.availableCredit
                    ),
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-sm">
          <Label htmlFor="total_installments">
            {t('pages.creditCardExpenses.form.installmentsLabel')}
          </Label>
          <Input
            id="total_installments"
            type="number"
            min="1"
            max="48"
            {...register('total_installments', {
              required: true,
              valueAsNumber: true,
              min: 1,
              max: 48,
            })}
            disabled={isLoading || isEditMode}
          />
          <div className="rounded-md bg-muted p-sm">
            {watchedTotalInstallments > 1 ? (
              <p className="text-sm font-medium text-primary">
                {t('pages.creditCardExpenses.form.installmentsSummary', {
                  total: formatCurrency(watchedTotalValue),
                  count: watchedTotalInstallments,
                  installmentValue: formatCurrency(installmentValue),
                })}
              </p>
            ) : (
              <p className="text-sm">
                {t('pages.creditCardExpenses.form.cashPayment')}
              </p>
            )}
          </div>
          {isEditMode && (
            <p className="text-xs text-warning">
              {t('pages.creditCardExpenses.form.installmentsLocked')}
            </p>
          )}
        </div>

        <div className="space-y-sm">
          <Label htmlFor="merchant">
            {t('pages.creditCardExpenses.form.merchantLabel')}
          </Label>
          <Input
            id="merchant"
            {...register('merchant')}
            placeholder={t('pages.creditCardExpenses.form.merchantPlaceholder')}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-sm md:col-span-2">
          <Label htmlFor="notes">{t('pages.creditCardExpenses.form.notesLabel')}</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder={t('pages.creditCardExpenses.form.notesPlaceholder')}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex justify-end gap-sm pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? t('common.actions.saving')
            : purchase
              ? t('common.actions.update')
              : t('pages.creditCardExpenses.form.createBtn')}
        </Button>
      </div>
    </form>
  );
};
