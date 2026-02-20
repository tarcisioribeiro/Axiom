import { useForm } from 'react-hook-form';
import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { TRANSLATIONS, EXPENSE_CATEGORIES_CANONICAL } from '@/config/constants';
import { formatCurrency } from '@/lib/formatters';
import type {
  CreditCardPurchase,
  CreditCardPurchaseFormData,
  CreditCard,
} from '@/types';

import { formatLocalDate } from '@/lib/utils';

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
        title: 'Campo obrigatório',
        description: 'Por favor, selecione um cartão de crédito',
        confirmText: 'Ok',
      });
      return;
    }
    if (!data.category) {
      await showAlert({
        title: 'Campo obrigatório',
        description: 'Por favor, selecione uma categoria',
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
        title: 'Limite insuficiente',
        description: `O valor de ${formatCurrency(data.total_value)} excede o limite disponível de ${formatCurrency(selectedCardInfo.availableCredit)} no cartão selecionado.`,
        confirmText: 'Ok',
      });
      return;
    }
    onSubmit(data);
  };

  // Mostrar aviso quando edição não permite mudar parcelas
  const isEditMode = !!purchase;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Descrição *</Label>
          <Input
            id="description"
            {...register('description', { required: true })}
            placeholder="Ex: Compra no mercado"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="total_value">Valor Total *</Label>
          <Input
            id="total_value"
            type="number"
            step="0.01"
            {...register('total_value', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading || isEditMode}
          />
          {isEditMode && (
            <p className="text-xs text-amber-600">
              Valor total não pode ser alterado após criação
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Categoria *</Label>
          <Select
            value={watch('category') || ''}
            onValueChange={(v) => setValue('category', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES_CANONICAL.map(({ key, label }) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchase_date">Data da Compra *</Label>
          <DatePicker
            value={watch('purchase_date')}
            onChange={(date) =>
              setValue('purchase_date', date ? formatLocalDate(date) : '')
            }
            placeholder="Selecione a data"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchase_time">Horário *</Label>
          <Input
            id="purchase_time"
            type="time"
            {...register('purchase_time', { required: true })}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label>Cartão de Crédito *</Label>
          <Select
            value={watch('card')?.toString() || ''}
            onValueChange={(v) => setValue('card', parseInt(v))}
            disabled={isEditMode}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {creditCards.map((c) => {
                const { last4, hasNumber, brandName, accountName } =
                  getCardDisplayInfo(c);
                return (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-sm">
                        {hasNumber ? `**** ${last4}` : 'Não cadastrado'}
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
            <p className="text-xs text-amber-600">
              Cartão não pode ser alterado após criação
            </p>
          )}
          {/* Exibir limite disponível do cartão selecionado */}
          {selectedCardInfo && !isEditMode && (
            <div
              className={`rounded-md p-2 text-sm ${exceedsLimit ? 'border border-destructive/30 bg-destructive/10' : 'bg-muted'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Limite disponível:</span>
                <span
                  className={`font-semibold ${exceedsLimit ? 'text-destructive' : 'text-success'}`}
                >
                  {formatCurrency(selectedCardInfo.availableCredit)}
                </span>
              </div>
              {exceedsLimit && watchedTotalValue > 0 && (
                <p className="mt-1 text-xs text-destructive">
                  Valor excede o limite em{' '}
                  {formatCurrency(watchedTotalValue - selectedCardInfo.availableCredit)}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="total_installments">Número de Parcelas *</Label>
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
          <div className="rounded-md bg-muted p-2">
            {watchedTotalInstallments > 1 ? (
              <p className="text-sm font-medium text-primary">
                {formatCurrency(watchedTotalValue)} em {watchedTotalInstallments}x de{' '}
                {formatCurrency(installmentValue)}
              </p>
            ) : (
              <p className="text-sm">Pagamento à vista</p>
            )}
          </div>
          {isEditMode && (
            <p className="text-xs text-amber-600">
              Parcelas não podem ser alteradas após criação
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="merchant">Estabelecimento</Label>
          <Input
            id="merchant"
            {...register('merchant')}
            placeholder="Ex: Supermercado XYZ"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder="Informações adicionais..."
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : purchase ? 'Atualizar' : 'Criar Compra'}
        </Button>
      </div>
    </form>
  );
};
